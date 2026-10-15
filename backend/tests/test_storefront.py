"""Tests for storefront / uploads / public catalog (iteration 4)."""
import os
import io
import pytest
import requests
from PIL import Image

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') if os.environ.get('REACT_APP_BACKEND_URL') else None
if not BASE_URL:
    # fallback: read frontend/.env
    for line in open('/app/frontend/.env'):
        if line.startswith('REACT_APP_BACKEND_URL='):
            BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
            break

PHONE = os.environ.get("TEST_ADMIN_PHONE", "")
PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "")


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"phone": PHONE, "password": PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def jpg_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (100, 100), color=(200, 100, 50)).save(buf, format="JPEG")
    return buf.getvalue()


# --- Uploads auth ---
def test_upload_requires_bearer(jpg_bytes):
    r = requests.post(f"{BASE_URL}/api/uploads", files={"file": ("x.jpg", jpg_bytes, "image/jpeg")}, timeout=30)
    assert r.status_code == 401


def test_upload_rejects_non_image(auth_headers):
    r = requests.post(f"{BASE_URL}/api/uploads",
                      files={"file": ("x.txt", b"hello", "text/plain")},
                      headers=auth_headers, timeout=30)
    assert r.status_code == 400


# --- Upload + public image + lifecycle ---
@pytest.fixture(scope="module")
def created_resources():
    return {"files": [], "clothes": []}


def test_upload_image_and_fetch_public(auth_headers, jpg_bytes, created_resources):
    r = requests.post(f"{BASE_URL}/api/uploads",
                      files={"file": ("test.jpg", jpg_bytes, "image/jpeg")},
                      headers=auth_headers, timeout=60)
    assert r.status_code == 200, r.text
    file_id = r.json()["id"]
    assert isinstance(file_id, str) and len(file_id) > 10
    created_resources["files"].append(file_id)

    # Public GET without auth works
    r2 = requests.get(f"{BASE_URL}/api/public/images/{file_id}", timeout=60)
    assert r2.status_code == 200
    assert r2.headers.get("content-type", "").startswith("image/")
    assert len(r2.content) > 100


def test_public_image_404(auth_headers):
    r = requests.get(f"{BASE_URL}/api/public/images/nonexistent-id-xyz", timeout=30)
    assert r.status_code == 404


# --- Public catalog grouping & cost hidden & qty0 excluded ---
def test_public_catalog_grouping_and_cost_hidden(auth_headers, jpg_bytes, created_resources):
    # upload one photo
    up = requests.post(f"{BASE_URL}/api/uploads",
                       files={"file": ("p.jpg", jpg_bytes, "image/jpeg")},
                       headers=auth_headers, timeout=60)
    photo_id = up.json()["id"]
    created_resources["files"].append(photo_id)

    base = {"name": "TEST_Vestido Linho", "category": "vestidos", "description": "Tecido leve",
            "photos": [photo_id], "cost": 60.0, "price": 189.9}
    v1 = {**base, "size": "P", "color": "Caramelo", "promotional_price": 169.9, "quantity": 3}
    v2 = {**base, "size": "M", "color": "Preto", "promotional_price": None, "quantity": 2}
    v3 = {**base, "size": "G", "color": "Preto", "quantity": 0}  # out of stock, must not appear

    for v in (v1, v2, v3):
        r = requests.post(f"{BASE_URL}/api/clothes", json=v, headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        created_resources["clothes"].append(r.json()["id"])

    r = requests.get(f"{BASE_URL}/api/public/catalog", timeout=30)
    assert r.status_code == 200
    cat = r.json()
    # cost never exposed
    raw = r.text
    assert "cost" not in raw, "Public catalog must not expose 'cost'"
    # Find grouped product
    prods = [p for p in cat if p["name"] == "TEST_Vestido Linho"]
    assert len(prods) == 1, f"Expected 1 grouped product, got {len(prods)}"
    p = prods[0]
    assert p["category"] == "vestidos"
    assert p["description"] == "Tecido leve"
    assert p["min_price"] == 189.9 and p["max_price"] == 189.9
    assert p["min_effective_price"] == 169.9 and p["max_effective_price"] == 189.9
    # Only 2 variants (qty>0)
    assert len(p["variants"]) == 2
    for v in p["variants"]:
        assert v["quantity"] > 0
        assert "cost" not in v
    assert any(v["promotional_price"] == 169.9 for v in p["variants"])


def test_public_catalog_requires_no_auth():
    r = requests.get(f"{BASE_URL}/api/public/catalog", timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# --- Clothes CRUD regression with category/description/photos ---
def test_clothing_create_with_category_and_photos(auth_headers, created_resources):
    body = {"name": "TEST_Body Regress", "category": "bodies", "description": "d",
            "photos": [], "size": "M", "color": "Azul", "cost": 10, "price": 50, "quantity": 1}
    r = requests.post(f"{BASE_URL}/api/clothes", json=body, headers=auth_headers, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["category"] == "bodies"
    assert data["description"] == "d"
    created_resources["clothes"].append(data["id"])


# --- Teardown ---
def test_zz_cleanup(auth_headers, created_resources):
    for cid in created_resources["clothes"]:
        requests.delete(f"{BASE_URL}/api/clothes/{cid}", headers=auth_headers, timeout=20)
    # files: mark deleted via direct Mongo? only API avail — leave as-is but at least verify catalog clean
    r = requests.get(f"{BASE_URL}/api/public/catalog", timeout=20)
    assert all(p["name"] != "TEST_Vestido Linho" for p in r.json())
