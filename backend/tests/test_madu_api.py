"""Backend API tests for Madu Brand store app."""
import os
import pytest
import requests

BASE_URL = os.environ.get("TEST_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api"

PHONE = os.environ.get("TEST_ADMIN_PHONE", "")
PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "")


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"phone": PHONE, "password": PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["phone"] == PHONE
    assert data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture
def auth(token):
    return {"Authorization": f"Bearer {token}"}


# --- Auth ---
class TestAuth:
    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_with_token(self, auth):
        r = requests.get(f"{API}/auth/me", headers=auth, timeout=15)
        assert r.status_code == 200
        assert r.json()["phone"] == PHONE

    def test_login_normalized_phone(self):
        # with mask
        r = requests.post(f"{API}/auth/login", json={"phone": "(16) 99195-6085", "password": PASSWORD}, timeout=15)
        assert r.status_code == 200

    def test_clothes_requires_auth(self):
        r = requests.get(f"{API}/clothes", timeout=15)
        assert r.status_code == 401

    def test_finance_requires_auth(self):
        r = requests.get(f"{API}/finance/summary", timeout=15)
        assert r.status_code == 401


# --- Clothes CRUD ---
class TestClothesCRUD:
    created_ids = []

    def test_full_crud(self, auth):
        payload = {"name": "TEST_Vestido", "size": "M", "color": "Caramelo", "cost": 50.0, "price": 150.0, "quantity": 3}
        r = requests.post(f"{API}/clothes", json=payload, headers=auth, timeout=15)
        assert r.status_code == 200
        item = r.json()
        assert item["name"] == payload["name"]
        assert item["cost"] == 50.0
        assert item["price"] == 150.0
        assert item["quantity"] == 3
        assert "id" in item and item["id"]
        assert "_id" not in item
        item_id = item["id"]
        TestClothesCRUD.created_ids.append(item_id)

        # list contains
        r = requests.get(f"{API}/clothes", headers=auth, timeout=15)
        assert r.status_code == 200
        assert any(c["id"] == item_id for c in r.json())

        # update
        upd = {**payload, "price": 200.0, "quantity": 5, "name": "TEST_Vestido Edit"}
        r = requests.put(f"{API}/clothes/{item_id}", json=upd, headers=auth, timeout=15)
        assert r.status_code == 200
        updated = r.json()
        assert updated["price"] == 200.0
        assert updated["quantity"] == 5
        assert updated["name"] == "TEST_Vestido Edit"

        # delete
        r = requests.delete(f"{API}/clothes/{item_id}", headers=auth, timeout=15)
        assert r.status_code == 200
        TestClothesCRUD.created_ids.remove(item_id)

        # verify gone
        r = requests.put(f"{API}/clothes/{item_id}", json=upd, headers=auth, timeout=15)
        assert r.status_code == 404

    def test_validation_errors(self, auth):
        r = requests.post(f"{API}/clothes", json={"name": "", "size": "M", "color": "a", "cost": 1, "price": 1, "quantity": 1}, headers=auth, timeout=15)
        assert r.status_code == 422
        r = requests.post(f"{API}/clothes", json={"name": "x", "size": "M", "color": "a", "cost": -1, "price": 1, "quantity": 1}, headers=auth, timeout=15)
        assert r.status_code == 422

    def test_invalid_id(self, auth):
        r = requests.delete(f"{API}/clothes/not-a-valid-id", headers=auth, timeout=15)
        assert r.status_code == 404


# --- Finance ---
class TestFinance:
    def test_summary_math(self, auth):
        # create 2 TEST items with known values
        a = requests.post(f"{API}/clothes", headers=auth, timeout=15,
                          json={"name": "TEST_A", "size": "P", "color": "x", "cost": 10, "price": 30, "quantity": 2}).json()
        b = requests.post(f"{API}/clothes", headers=auth, timeout=15,
                          json={"name": "TEST_B", "size": "G", "color": "y", "cost": 20, "price": 50, "quantity": 1}).json()
        try:
            r = requests.get(f"{API}/finance/summary", headers=auth, timeout=15)
            assert r.status_code == 200
            s = r.json()
            # weighted totals should include at least our contributions
            assert s["units"] >= 3
            assert s["total_cost"] >= 40
            assert s["total_revenue"] >= 110
            assert s["total_profit"] >= 70
            # keys exist
            for k in ("average_cost", "average_price", "average_profit", "margin", "items"):
                assert k in s
            # per-item: find our items with unit_profit calc
            ours = [it for it in s["items"] if it["id"] in (a["id"], b["id"])]
            assert len(ours) == 2
            for it in ours:
                assert it["unit_profit"] == it["price"] - it["cost"]
                assert it["total_profit"] == (it["price"] - it["cost"]) * it["quantity"]
        finally:
            for it in (a, b):
                requests.delete(f"{API}/clothes/{it['id']}", headers=auth, timeout=15)


# --- Teardown: cleanup any leftover TEST_ items ---
@pytest.fixture(scope="session", autouse=True)
def cleanup(token):
    yield
    headers = {"Authorization": f"Bearer {token}"}
    try:
        r = requests.get(f"{API}/clothes", headers=headers, timeout=15)
        if r.status_code == 200:
            for c in r.json():
                if c.get("name", "").startswith("TEST_"):
                    requests.delete(f"{API}/clothes/{c['id']}", headers=headers, timeout=15)
    except Exception:
        pass
