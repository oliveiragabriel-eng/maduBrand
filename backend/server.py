from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import logging
import time
import io
from collections import OrderedDict
from datetime import datetime, timezone, timedelta
from typing import Annotated, List, Literal, Optional
from zoneinfo import ZoneInfo

import bcrypt
import jwt
from bson import ObjectId
import json
from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, UploadFile, File, Query
from fastapi.responses import JSONResponse, StreamingResponse, Response
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator
from starlette.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
image_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="product_images")
image_variant_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="product_image_variants")

JWT_ALGORITHM = "HS256"
app = FastAPI()
api = APIRouter(prefix="/api")
PUBLIC_CATALOG_CACHE_TTL = 60
_public_catalog_cache = None
_image_variant_cache = OrderedDict()
_image_variant_cache_bytes = 0
IMAGE_VARIANT_CACHE_MAX_BYTES = 24 * 1024 * 1024
IMAGE_VARIANT_WIDTHS = (480, 800, 1200)
IMAGE_VARIANT_QUALITY = 78


def resize_public_image(data: bytes, width: int, quality: int) -> bytes:
    with Image.open(io.BytesIO(data)) as source:
        image = ImageOps.exif_transpose(source)
        image.thumbnail((width, 1600), Image.Resampling.LANCZOS)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
        output = io.BytesIO()
        image.save(output, format="WEBP", quality=quality, method=6)
        return output.getvalue()


async def public_image_variant(data: bytes, file_id: str, width: int, quality: int):
    global _image_variant_cache_bytes
    key = (file_id, width, quality)
    cached = _image_variant_cache.get(key)
    if cached:
        _image_variant_cache.move_to_end(key)
        return cached
    variant = await run_in_threadpool(resize_public_image, data, width, quality)
    _image_variant_cache[key] = variant
    _image_variant_cache_bytes += len(variant)
    while _image_variant_cache_bytes > IMAGE_VARIANT_CACHE_MAX_BYTES and _image_variant_cache:
        _, removed = _image_variant_cache.popitem(last=False)
        _image_variant_cache_bytes -= len(removed)
    return variant


async def store_pre_generated_variants(file_id: str, original: bytes):
    """Create durable WebP variants without replacing the original upload."""
    for width in IMAGE_VARIANT_WIDTHS:
        existing = await db.image_variants.find_one({
            "source_file_id": file_id, "width": width, "quality": IMAGE_VARIANT_QUALITY,
        })
        if existing:
            continue
        data = await run_in_threadpool(resize_public_image, original, width, IMAGE_VARIANT_QUALITY)
        upload = image_variant_bucket.open_upload_stream(
            f"{file_id}-{width}.webp",
            metadata={"source_file_id": file_id, "width": width, "quality": IMAGE_VARIANT_QUALITY, "content_type": "image/webp"},
        )
        await upload.write(data)
        await upload.close()
        await db.image_variants.update_one(
            {"source_file_id": file_id, "width": width, "quality": IMAGE_VARIANT_QUALITY},
            {"$setOnInsert": {
                "source_file_id": file_id, "variant_file_id": str(upload._id),
                "width": width, "quality": IMAGE_VARIANT_QUALITY,
                "content_type": "image/webp", "bytes": len(data),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )


@app.get("/health", include_in_schema=False)
async def health():
    """Lightweight liveness endpoint for Render and external monitors."""
    return {"status": "ok"}

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc):
        return cls.model_validate(doc)

    def to_mongo(self):
        data = self.model_dump(by_alias=True, exclude={"id"})
        return data


CATEGORIES = ("bodies", "croppeds", "vestidos", "saias", "calcas")
Category = Literal["bodies", "croppeds", "vestidos", "saias", "calcas"]


class ClothingIn(BaseModel):
    name: str = Field(min_length=1)
    category: Category = "bodies"
    description: str = ""
    photos: List[str] = []
    size: str = Field(min_length=1)
    color: str = Field(min_length=1)
    cost: float = Field(ge=0)
    price: float = Field(ge=0)
    promotional_price: Optional[float] = Field(default=None, ge=0)
    quantity: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_promotional_price(self):
        if self.promotional_price is not None and self.promotional_price > self.price:
            raise ValueError("O valor promocional não pode ser maior que o preço de venda")
        return self


class Clothing(BaseDocument, ClothingIn):
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def out(self):
        return self.model_dump()


class LoginIn(BaseModel):
    phone: str
    password: str


def normalize_phone(p: str) -> str:
    return re.sub(r"\D", "", p)


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())


def create_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "access", "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def public_user(u):
    return {"id": str(u["_id"]), "phone": u["phone"], "name": u.get("name"), "email": u.get("email"), "role": u.get("role")}


async def get_current_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Não autenticado")
    try:
        payload = jwt.decode(auth[7:], os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")
    try:
        user_id = ObjectId(payload["sub"])
    except Exception:
        raise HTTPException(401, "Token inválido")
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(401, "Usuário não encontrado")
    # This application currently exposes an admin dashboard, not customer accounts.
    if user.get("role") != "admin":
        raise HTTPException(403, "Acesso restrito ao administrador")
    return user


@api.post("/auth/login")
async def login(body: LoginIn, request: Request):
    phone = normalize_phone(body.phone)
    ident = f"{request.client.host if request.client else 'x'}:{phone}"
    now = datetime.now(timezone.utc)
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5 and att.get("locked_until") and datetime.fromisoformat(att["locked_until"]) > now:
        raise HTTPException(429, "Muitas tentativas. Tente novamente em 15 minutos.")
    user = await db.users.find_one({"phone": phone})
    if not user or not verify_password(body.password, user["password_hash"]):
        count = (att.get("count", 0) if att else 0) + 1
        upd = {"count": count}
        if count >= 5:
            upd["locked_until"] = (now + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": ident}, {"$set": upd}, upsert=True)
        raise HTTPException(401, "Telefone ou senha incorretos")
    await db.login_attempts.delete_many({"identifier": ident})
    return {"token": create_token(str(user["_id"])), "user": public_user(user)}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return public_user(user)


@api.get("/clothes")
async def list_clothes(user=Depends(get_current_user)):
    docs = await db.clothes.find().sort("created_at", -1).to_list(5000)
    cond = {r["_id"]: r["qty"] for r in await db.sales.aggregate([
        {"$match": {"status": "condicional"}},
        {"$group": {"_id": "$clothing_id", "qty": {"$sum": "$quantity"}}},
    ]).to_list(5000)}
    return [{**Clothing.from_mongo(d).out(), "on_conditional": cond.get(str(d["_id"]), 0)} for d in docs]


@api.post("/clothes")
async def create_clothing(body: ClothingIn, user=Depends(get_current_user)):
    item = Clothing(**body.model_dump())
    res = await db.clothes.insert_one(item.to_mongo())
    item.id = str(res.inserted_id)
    return item.out()


def oid(item_id: str) -> ObjectId:
    if not ObjectId.is_valid(item_id):
        raise HTTPException(404, "Peça não encontrada")
    return ObjectId(item_id)


@api.put("/clothes/{item_id}")
async def update_clothing(item_id: str, body: ClothingIn, user=Depends(get_current_user)):
    doc = await db.clothes.find_one_and_update({"_id": oid(item_id)}, {"$set": body.model_dump()}, return_document=True)
    if not doc:
        raise HTTPException(404, "Peça não encontrada")
    return Clothing.from_mongo(doc).out()


@api.delete("/clothes/{item_id}")
async def delete_clothing(item_id: str, user=Depends(get_current_user)):
    res = await db.clothes.delete_one({"_id": oid(item_id)})
    if res.deleted_count == 0:
        raise HTTPException(404, "Peça não encontrada")
    return {"ok": True}


IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


@api.post("/uploads")
async def upload_image(file: UploadFile = File(...), user=Depends(get_current_user)):
    if file.content_type not in IMAGE_TYPES:
        raise HTTPException(400, "Envie uma imagem JPG, PNG ou WEBP")
    data = await file.read()
    if not data:
        raise HTTPException(400, "O arquivo está vazio")
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "Imagem muito grande (máx. 10 MB)")

    # As imagens ficam no GridFS do mesmo MongoDB Atlas usado pela aplicação.
    # O disco local do servidor não é usado, portanto uploads sobrevivem a redeploys.
    upload_stream = image_bucket.open_upload_stream(
        file.filename or "produto",
        metadata={
            "content_type": file.content_type,
            "original_filename": file.filename or "produto",
            "uploaded_by": str(user["_id"]),
        },
    )
    await upload_stream.write(data)
    await upload_stream.close()
    file_id = str(upload_stream._id)
    await db.files.insert_one({
        "file_id": file_id,
        "content_type": file.content_type,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await store_pre_generated_variants(file_id, data)
    return {"id": file_id}


@api.get("/public/images/{file_id}")
async def public_image(
    file_id: str,
    width: Optional[int] = Query(default=None, alias="w", ge=320, le=1600),
    quality: int = Query(default=78, alias="q", ge=60, le=90),
):
    rec = await db.files.find_one({"file_id": file_id, "is_deleted": False})
    if not rec or not ObjectId.is_valid(file_id):
        raise HTTPException(404, "Imagem não encontrada")
    variant = None
    if width:
        variant = await db.image_variants.find_one({
            "source_file_id": file_id, "width": width, "quality": quality,
        })
        if variant and ObjectId.is_valid(variant.get("variant_file_id", "")):
            try:
                variant_stream = await image_variant_bucket.open_download_stream(ObjectId(variant["variant_file_id"]))
                data = await variant_stream.read()
                return Response(content=data, media_type="image/webp", headers={"Cache-Control": "public, max-age=31536000, immutable"})
            except Exception:
                pass
    try:
        stream = await image_bucket.open_download_stream(ObjectId(file_id))
        data = await stream.read()
    except Exception:
        raise HTTPException(404, "Imagem não encontrada")
    if width:
        data = await public_image_variant(data, file_id, width, quality)
        return Response(content=data, media_type="image/webp", headers={"Cache-Control": "public, max-age=31536000, immutable"})
    return Response(content=data, media_type=rec["content_type"], headers={"Cache-Control": "public, max-age=31536000, immutable"})


@api.get("/public/catalog")
async def public_catalog():
    global _public_catalog_cache
    now = time.monotonic()
    if _public_catalog_cache and now - _public_catalog_cache["created_at"] < PUBLIC_CATALOG_CACHE_TTL:
        return JSONResponse(content=_public_catalog_cache["data"], headers={"Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=60"})

    projection = {
        "name": 1, "category": 1, "description": 1, "size": 1, "color": 1,
        "price": 1, "promotional_price": 1, "quantity": 1, "photos": 1, "created_at": 1,
    }
    docs = await db.clothes.find({"quantity": {"$gt": 0}}, projection).sort("created_at", -1).limit(5000).to_list(5000)
    products = {}
    for c in docs:
        name = c.get("name", "").strip()
        category = c.get("category", "bodies")
        key = f"{category}:{name.lower()}"
        p = products.setdefault(key, {"key": key, "name": name, "category": category, "description": "", "variants": []})
        p["description"] = p["description"] or c.get("description", "")
        p["variants"].append({"id": str(c["_id"]), "size": c.get("size", ""), "color": c.get("color", ""), "price": c.get("price", 0), "promotional_price": c.get("promotional_price"), "quantity": c.get("quantity", 0), "photos": c.get("photos", [])})
    for p in products.values():
        prices = [v["price"] for v in p["variants"]]
        p["min_price"], p["max_price"] = min(prices), max(prices)
        effective_prices = [v["promotional_price"] if v["promotional_price"] is not None else v["price"] for v in p["variants"]]
        p["min_effective_price"], p["max_effective_price"] = min(effective_prices), max(effective_prices)
        p["photos"] = [ph for v in p["variants"] for ph in v["photos"]]
    data = list(products.values())
    _public_catalog_cache = {"created_at": now, "data": data}
    return JSONResponse(content=data, headers={"Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=60"})


@api.get("/finance/summary")
async def finance_summary(user=Depends(get_current_user)):
    return await compute_summary()


async def compute_summary():
    docs = [Clothing.from_mongo(d) for d in await db.clothes.find().to_list(5000)]
    units = sum(c.quantity for c in docs)
    total_cost = sum(c.cost * c.quantity for c in docs)
    total_revenue = sum(c.price * c.quantity for c in docs)
    total_profit = total_revenue - total_cost
    items = [{
        "id": c.id, "name": c.name, "size": c.size, "color": c.color, "quantity": c.quantity,
        "cost": c.cost, "price": c.price,
        "unit_profit": c.price - c.cost,
        "total_profit": (c.price - c.cost) * c.quantity,
        "margin": ((c.price - c.cost) / c.price * 100) if c.price > 0 else 0,
    } for c in docs]
    items.sort(key=lambda i: i["total_profit"], reverse=True)
    return {
        "models": len(docs),
        "units": units,
        "total_cost": total_cost,
        "total_revenue": total_revenue,
        "total_profit": total_profit,
        "average_cost": total_cost / units if units else 0,
        "average_price": total_revenue / units if units else 0,
        "average_profit": total_profit / units if units else 0,
        "margin": (total_profit / total_revenue * 100) if total_revenue else 0,
        "items": items,
    }


BR_TZ = ZoneInfo("America/Sao_Paulo")
CREDIT_SURCHARGE = 5.0


def now_br() -> str:
    return datetime.now(BR_TZ).isoformat()


class SaleIn(BaseModel):
    clothing_id: str
    quantity: int = Field(ge=1)
    unit_price: float = Field(ge=0)
    type: Literal["venda", "condicional"]
    client: str = Field(min_length=1)
    payment_method: Literal["pix", "credito", "crediario"]
    installments: int = Field(default=1, ge=1, le=3)
    due_date: Optional[str] = None
    paid: bool = False


class Sale(BaseDocument):
    clothing_id: str
    clothing_name: str
    size: str
    color: str
    quantity: int
    unit_cost: float
    unit_price: float
    client: str
    payment_method: str
    installments: int = 1
    surcharge_pct: float = 0
    total: float
    due_date: Optional[str] = None
    paid: bool = False
    status: str
    created_at: str = Field(default_factory=now_br)
    sold_at: Optional[str] = None

    def out(self):
        return {**self.model_dump(), "profit": self.total - self.unit_cost * self.quantity}


class SalePatch(BaseModel):
    paid: Optional[bool] = None
    action: Optional[Literal["vender", "devolver"]] = None


@api.get("/sales")
async def list_sales(user=Depends(get_current_user)):
    docs = await db.sales.find().sort("created_at", -1).to_list(5000)
    return [Sale.from_mongo(d).out() for d in docs]


@api.post("/sales")
async def create_sale(body: SaleIn, user=Depends(get_current_user)):
    if body.payment_method == "crediario" and not body.due_date:
        raise HTTPException(400, "Informe a data de pagamento do crediário")
    item = await db.clothes.find_one_and_update(
        {"_id": oid(body.clothing_id), "quantity": {"$gte": body.quantity}},
        {"$inc": {"quantity": -body.quantity}}, return_document=True,
    )
    if not item:
        raise HTTPException(400, "Estoque insuficiente para esta peça")
    installments = body.installments if body.payment_method == "credito" else 1
    surcharge = CREDIT_SURCHARGE if body.payment_method == "credito" and installments > 1 else 0
    sale = Sale(
        clothing_id=body.clothing_id, clothing_name=item["name"], size=item["size"], color=item["color"],
        quantity=body.quantity, unit_cost=item["cost"], unit_price=body.unit_price, client=body.client.strip(),
        payment_method=body.payment_method, installments=installments, surcharge_pct=surcharge,
        total=round(body.unit_price * body.quantity * (1 + surcharge / 100), 2),
        due_date=body.due_date if body.payment_method == "crediario" else None,
        paid=body.paid, status="vendida" if body.type == "venda" else "condicional",
    )
    if sale.status == "vendida":
        sale.sold_at = sale.created_at
    res = await db.sales.insert_one(sale.to_mongo())
    sale.id = str(res.inserted_id)
    return sale.out()


async def get_sale(sale_id: str) -> Sale:
    if not ObjectId.is_valid(sale_id):
        raise HTTPException(404, "Venda não encontrada")
    doc = await db.sales.find_one({"_id": ObjectId(sale_id)})
    if not doc:
        raise HTTPException(404, "Venda não encontrada")
    return Sale.from_mongo(doc)


@api.patch("/sales/{sale_id}")
async def update_sale(sale_id: str, body: SalePatch, user=Depends(get_current_user)):
    sale = await get_sale(sale_id)
    upd = {}
    if body.paid is not None:
        upd["paid"] = body.paid
    if body.action:
        if sale.status != "condicional":
            raise HTTPException(400, "Apenas peças em condicional podem ser alteradas")
        if body.action == "vender":
            upd.update(status="vendida", sold_at=now_br())
        else:
            upd["status"] = "devolvida"
            await db.clothes.update_one({"_id": ObjectId(sale.clothing_id)}, {"$inc": {"quantity": sale.quantity}})
    if upd:
        await db.sales.update_one({"_id": ObjectId(sale_id)}, {"$set": upd})
    return (await get_sale(sale_id)).out()


@api.delete("/sales/{sale_id}")
async def delete_sale(sale_id: str, user=Depends(get_current_user)):
    sale = await get_sale(sale_id)
    if sale.status != "devolvida":
        await db.clothes.update_one({"_id": ObjectId(sale.clothing_id)}, {"$inc": {"quantity": sale.quantity}})
    await db.sales.delete_one({"_id": ObjectId(sale_id)})
    return {"ok": True}


@api.get("/sales/summary")
async def sales_summary(month: str, user=Depends(get_current_user)):
    if not re.fullmatch(r"\d{4}-\d{2}", month):
        raise HTTPException(400, "Mês inválido")
    sold = [Sale.from_mongo(d) for d in await db.sales.find({"status": "vendida", "sold_at": {"$regex": f"^{month}"}}).to_list(5000)]
    revenue = sum(s.total for s in sold)
    cost = sum(s.unit_cost * s.quantity for s in sold)
    cond = await db.sales.count_documents({"status": "condicional"})
    return {
        "month": month, "sales": len(sold), "units": sum(s.quantity for s in sold),
        "revenue": revenue, "cost": cost, "profit": revenue - cost,
        "received": sum(s.total for s in sold if s.paid),
        "pending": sum(s.total for s in sold if not s.paid),
        "open_conditionals": cond,
    }


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


def build_system_prompt(s):
    lines = [
        f"- {i['name']} | tam {i['size']} | cor {i['color']} | qtd {i['quantity']} | custo R$ {i['cost']:.2f} | venda R$ {i['price']:.2f} | lucro unit R$ {i['unit_profit']:.2f} | margem {i['margin']:.1f}% | lucro total R$ {i['total_profit']:.2f}"
        for i in s["items"]
    ]
    return (
        "Você é a assistente da loja de roupas Madu Brand. Responda em português do Brasil, de forma curta, clara e simpática, "
        "usando apenas os dados abaixo sobre estoque, custos e lucros. Valores em reais (R$). Se não souber, diga que não há dados.\n\n"
        f"RESUMO: {s['models']} modelos, {s['units']} peças em estoque. Total investido R$ {s['total_cost']:.2f}. "
        f"Faturamento esperado R$ {s['total_revenue']:.2f}. Lucro projetado R$ {s['total_profit']:.2f}. Margem {s['margin']:.1f}%. "
        f"Custo médio por peça R$ {s['average_cost']:.2f}. Venda média R$ {s['average_price']:.2f}. Lucro médio R$ {s['average_profit']:.2f}.\n\n"
        "PEÇAS:\n" + ("\n".join(lines) or "(nenhuma peça cadastrada)")
    )


@api.get("/assistant/messages")
async def assistant_messages(user=Depends(get_current_user)):
    docs = await db.assistant_messages.find({"user_id": str(user["_id"])}, {"_id": 0, "role": 1, "content": 1}).sort("created_at", 1).to_list(500)
    return docs


@api.delete("/assistant/messages")
async def clear_assistant(user=Depends(get_current_user)):
    await db.assistant_messages.delete_many({"user_id": str(user["_id"])})
    return {"ok": True}


def answer_without_external_ai(message: str, summary: dict) -> str:
    """Respostas locais baseadas em cálculos e dados reais da loja; não chama APIs de IA."""
    q = message.casefold()
    items = summary["items"]
    if not items:
        return "Ainda não há peças cadastradas. Cadastre produtos para eu calcular estoque, custos e lucros."

    best_unit = max(items, key=lambda i: i["unit_profit"])
    best_total = max(items, key=lambda i: i["total_profit"])
    low_margin = sorted([i for i in items if i["price"] > 0], key=lambda i: i["margin"])
    out_of_stock = [i for i in items if i["quantity"] <= 0]

    if any(k in q for k in ["maior lucro", "mais lucro", "dá mais lucro", "da mais lucro", "lucrativa"]):
        return (f"Maior lucro por unidade: {best_unit['name']} ({best_unit['size']}, {best_unit['color']}). "
                f"Lucro unitário de R$ {best_unit['unit_profit']:.2f}, margem de {best_unit['margin']:.1f}%. "
                f"Considerando todo o estoque, {best_total['name']} tem o maior lucro projetado: R$ {best_total['total_profit']:.2f}.")
    if any(k in q for k in ["todo o estoque", "lucro projetado", "lucro total", "quanto lucr", "lucraria"]):
        return (f"Com a venda de todo o estoque atual pelo preço cadastrado, o faturamento projetado é R$ {summary['total_revenue']:.2f}, "
                f"o custo das peças é R$ {summary['total_cost']:.2f} e o lucro bruto projetado é R$ {summary['total_profit']:.2f}. "
                "Esse cálculo não inclui despesas, taxas, impostos ou descontos.")
    if any(k in q for k in ["margem baixa", "margens", "menor margem", "margem menor"]):
        if not low_margin:
            return "Não encontrei produtos com preço de venda válido para calcular a margem."
        rows = low_margin[:5]
        return "Produtos com as menores margens: " + "; ".join(f"{i['name']}: {i['margin']:.1f}% (lucro unitário R$ {i['unit_profit']:.2f})" for i in rows) + "."
    if any(k in q for k in ["custo médio", "custo medio", "preço médio", "preco medio", "lucro médio", "lucro medio"]):
        return (f"Por peça em estoque: custo médio R$ {summary['average_cost']:.2f}, preço de venda médio R$ {summary['average_price']:.2f} "
                f"e lucro bruto médio R$ {summary['average_profit']:.2f}.")
    if any(k in q for k in ["estoque", "quantas peças", "quantas pecas", "quantidade", "faltando", "sem estoque"]):
        answer = f"Há {summary['units']} peças em estoque, distribuídas em {summary['models']} cadastros."
        if out_of_stock:
            answer += " Sem estoque: " + ", ".join(i['name'] for i in out_of_stock[:10]) + "."
        return answer
    if any(k in q for k in ["investido", "investimento", "capital"]):
        return f"O custo total estimado das peças atualmente em estoque é R$ {summary['total_cost']:.2f}."
    if any(k in q for k in ["faturamento", "vender tudo", "venda total"]):
        return f"Se vender todo o estoque pelo preço cadastrado, o faturamento bruto projetado é R$ {summary['total_revenue']:.2f}. Isso não desconta taxas, despesas ou impostos."
    return ("Consigo responder perguntas sobre: maior lucro por peça, lucro projetado do estoque, menores margens, "
            "custo médio, faturamento, investimento e quantidade em estoque. Experimente uma dessas perguntas.")


@api.post("/assistant/chat")
async def assistant_chat(body: ChatIn, user=Depends(get_current_user)):
    uid = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()
    await db.assistant_messages.insert_one({"user_id": uid, "role": "user", "content": body.message, "created_at": now})
    answer = answer_without_external_ai(body.message, await compute_summary())
    await db.assistant_messages.insert_one({"user_id": uid, "role": "assistant", "content": answer, "created_at": datetime.now(timezone.utc).isoformat()})

    async def gen():
        # Mantém o formato SSE esperado pelo frontend, enviando a resposta local em um bloco.
        yield f"data: {json.dumps({'delta': answer}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ['CORS_ORIGINS'].split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    jwt_secret = os.environ.get("JWT_SECRET", "")
    cors_origins = [origin.strip() for origin in os.environ.get("CORS_ORIGINS", "").split(",") if origin.strip()]
    if len(jwt_secret.encode("utf-8")) < 32 or "SUBSTITUA" in jwt_secret or "CHANGE_ME" in jwt_secret:
        raise RuntimeError("JWT_SECRET deve ser um segredo aleatório de pelo menos 32 bytes")
    if not cors_origins or "*" in cors_origins:
        raise RuntimeError("CORS_ORIGINS deve listar explicitamente os domínios autorizados")
    await db.users.create_index("phone", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.files.create_index("file_id", unique=True)
    await db.clothes.update_many({"category": {"$exists": False}}, {"$set": {"category": "bodies", "description": "", "photos": []}})
    phone = normalize_phone(os.environ["ADMIN_PHONE"])
    pwd = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"phone": phone})
    if existing is None:
        await db.users.insert_one({
            "phone": phone, "email": os.environ["ADMIN_EMAIL"], "name": "Madu Brand", "role": "admin",
            "password_hash": hash_password(pwd), "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(pwd, existing["password_hash"]):
        await db.users.update_one({"phone": phone}, {"$set": {"password_hash": hash_password(pwd)}})


@app.on_event("shutdown")
async def shutdown():
    client.close()


logging.basicConfig(level=logging.INFO)
