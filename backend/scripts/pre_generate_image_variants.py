"""Pré-gera variantes WebP no GridFS sem alterar os arquivos originais.

Uso:
  python backend/scripts/pre_generate_image_variants.py --dry-run
  python backend/scripts/pre_generate_image_variants.py
"""
import argparse
import asyncio
import io
import os
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from bson import ObjectId
from PIL import Image, ImageOps

VARIANT_WIDTHS = (480, 800, 1200)
VARIANT_QUALITY = 78


def resize_image(data: bytes, width: int, quality: int) -> bytes:
    with Image.open(io.BytesIO(data)) as source:
        image = ImageOps.exif_transpose(source)
        image.thumbnail((width, 1600), Image.Resampling.LANCZOS)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
        output = io.BytesIO()
        image.save(output, format="WEBP", quality=quality, method=6)
        return output.getvalue()


async def main(dry_run: bool) -> None:
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    originals = AsyncIOMotorGridFSBucket(db, bucket_name="product_images")
    variants = AsyncIOMotorGridFSBucket(db, bucket_name="product_image_variants")
    records = await db.files.find({"is_deleted": False}, {"file_id": 1}).to_list(None)
    print(f"Imagens originais encontradas: {len(records)}")
    print(f"Variantes planejadas: {len(records) * len(VARIANT_WIDTHS)}")
    if dry_run:
        await client.close()
        return

    await db.image_variants.create_index(
        [("source_file_id", 1), ("width", 1), ("quality", 1)], unique=True
    )
    created = 0
    skipped = 0
    for record in records:
        source_id = record["file_id"]
        if not ObjectId.is_valid(source_id):
            continue
        try:
            stream = await originals.open_download_stream(ObjectId(source_id))
            original = await stream.read()
        except Exception as exc:
            print(f"Pulando {source_id}: não foi possível ler o original ({exc})")
            continue
        for width in VARIANT_WIDTHS:
            exists = await db.image_variants.find_one(
                {"source_file_id": source_id, "width": width, "quality": VARIANT_QUALITY},
                {"_id": 1},
            )
            if exists:
                skipped += 1
                continue
            data = resize_image(original, width, VARIANT_QUALITY)
            upload = variants.open_upload_stream(
                f"{source_id}-{width}.webp",
                metadata={
                    "source_file_id": source_id,
                    "width": width,
                    "quality": VARIANT_QUALITY,
                    "content_type": "image/webp",
                },
            )
            await upload.write(data)
            await upload.close()
            await db.image_variants.insert_one({
                "source_file_id": source_id,
                "variant_file_id": str(upload._id),
                "width": width,
                "quality": VARIANT_QUALITY,
                "content_type": "image/webp",
                "bytes": len(data),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            created += 1
    await client.close()
    print(f"Variantes criadas: {created}; já existentes: {skipped}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(args.dry_run))
