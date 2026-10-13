"""Tests for Madu Brand Sales (vendas) endpoints."""
import os
import re
from datetime import datetime, date

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
PHONE = os.environ.get("TEST_ADMIN_PHONE", "")
PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "")


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"phone": PHONE, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture
def test_item(auth):
    """Create a TEST_ clothing item for sales tests, cleanup after."""
    payload = {"name": "TEST_SalesItem", "size": "M", "color": "Preto", "cost": 50.0, "price": 100.0, "quantity": 10}
    r = auth.post(f"{BASE_URL}/api/clothes", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    item = r.json()
    yield item
    # cleanup
    auth.delete(f"{BASE_URL}/api/clothes/{item['id']}", timeout=15)


def _delete_sale(auth, sid):
    try:
        auth.delete(f"{BASE_URL}/api/sales/{sid}", timeout=15)
    except Exception:
        pass


# -------- Auth / routing --------

def test_sales_list_requires_auth():
    r = requests.get(f"{BASE_URL}/api/sales", timeout=15)
    assert r.status_code == 401


def test_sales_list_ok(auth):
    r = auth.get(f"{BASE_URL}/api/sales", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_sales_summary_route_resolves(auth):
    """Verify /sales/summary isn't shadowed by /sales/{sale_id} patch route."""
    r = auth.get(f"{BASE_URL}/api/sales/summary", params={"month": "2026-01"}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["month"] == "2026-01"
    for k in ("sales", "units", "revenue", "cost", "profit", "received", "pending", "open_conditionals"):
        assert k in data


def test_sales_summary_invalid_month(auth):
    r = auth.get(f"{BASE_URL}/api/sales/summary", params={"month": "2026/01"}, timeout=15)
    assert r.status_code == 400


# -------- Create sale (venda) --------

def test_create_venda_pix_decrements_stock(auth, test_item):
    initial_qty = test_item["quantity"]
    payload = {
        "clothing_id": test_item["id"], "quantity": 2, "unit_price": 100.0,
        "type": "venda", "client": "TEST_Cliente", "payment_method": "pix",
        "installments": 1, "paid": True,
    }
    r = auth.post(f"{BASE_URL}/api/sales", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    sale = r.json()
    assert sale["status"] == "vendida"
    assert sale["total"] == 200.0
    assert sale["surcharge_pct"] == 0
    assert sale["paid"] is True
    assert sale["sold_at"] is not None
    assert sale["profit"] == 200.0 - 50.0 * 2  # 100

    # stock decremented
    clothes = auth.get(f"{BASE_URL}/api/clothes", timeout=15).json()
    item = next(c for c in clothes if c["id"] == test_item["id"])
    assert item["quantity"] == initial_qty - 2

    _delete_sale(auth, sale["id"])


def test_create_credito_2x_has_5pct_surcharge(auth, test_item):
    payload = {
        "clothing_id": test_item["id"], "quantity": 1, "unit_price": 100.0,
        "type": "venda", "client": "TEST_Cliente", "payment_method": "credito",
        "installments": 2, "paid": True,
    }
    r = auth.post(f"{BASE_URL}/api/sales", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    sale = r.json()
    assert sale["surcharge_pct"] == 5.0
    assert sale["installments"] == 2
    assert sale["total"] == 105.0
    _delete_sale(auth, sale["id"])


def test_create_credito_1x_no_surcharge(auth, test_item):
    payload = {
        "clothing_id": test_item["id"], "quantity": 1, "unit_price": 100.0,
        "type": "venda", "client": "TEST_Cliente", "payment_method": "credito",
        "installments": 1, "paid": True,
    }
    r = auth.post(f"{BASE_URL}/api/sales", json=payload, timeout=15)
    assert r.status_code == 200
    sale = r.json()
    assert sale["surcharge_pct"] == 0
    assert sale["total"] == 100.0
    _delete_sale(auth, sale["id"])


def test_create_crediario_requires_due_date(auth, test_item):
    payload = {
        "clothing_id": test_item["id"], "quantity": 1, "unit_price": 100.0,
        "type": "venda", "client": "TEST_Cliente", "payment_method": "crediario",
        "installments": 1, "paid": False,
    }
    r = auth.post(f"{BASE_URL}/api/sales", json=payload, timeout=15)
    assert r.status_code == 400
    assert "crediário" in r.json()["detail"].lower() or "crediario" in r.json()["detail"].lower()


def test_create_crediario_with_due_date(auth, test_item):
    payload = {
        "clothing_id": test_item["id"], "quantity": 1, "unit_price": 100.0,
        "type": "venda", "client": "TEST_Cliente", "payment_method": "crediario",
        "due_date": "2026-02-10", "paid": False,
    }
    r = auth.post(f"{BASE_URL}/api/sales", json=payload, timeout=15)
    assert r.status_code == 200
    sale = r.json()
    assert sale["due_date"] == "2026-02-10"
    assert sale["payment_method"] == "crediario"
    _delete_sale(auth, sale["id"])


def test_insufficient_stock_returns_400(auth, test_item):
    payload = {
        "clothing_id": test_item["id"], "quantity": 999, "unit_price": 100.0,
        "type": "venda", "client": "TEST_Cliente", "payment_method": "pix", "paid": True,
    }
    r = auth.post(f"{BASE_URL}/api/sales", json=payload, timeout=15)
    assert r.status_code == 400
    assert "estoque" in r.json()["detail"].lower()


# -------- Condicional flow --------

def test_condicional_shows_on_clothing_and_convert(auth, test_item):
    initial_qty = test_item["quantity"]
    payload = {
        "clothing_id": test_item["id"], "quantity": 3, "unit_price": 100.0,
        "type": "condicional", "client": "TEST_CondCliente", "payment_method": "pix", "paid": False,
    }
    r = auth.post(f"{BASE_URL}/api/sales", json=payload, timeout=15)
    assert r.status_code == 200
    sale = r.json()
    assert sale["status"] == "condicional"
    assert sale["sold_at"] is None

    # on_conditional reflected in clothes
    clothes = auth.get(f"{BASE_URL}/api/clothes", timeout=15).json()
    item = next(c for c in clothes if c["id"] == test_item["id"])
    assert item["on_conditional"] == 3
    assert item["quantity"] == initial_qty - 3

    # Not counted in summary profit yet
    month = datetime.now().strftime("%Y-%m")
    before = auth.get(f"{BASE_URL}/api/sales/summary", params={"month": month}, timeout=15).json()
    assert before["open_conditionals"] >= 1

    # Convert to vendida
    r = auth.patch(f"{BASE_URL}/api/sales/{sale['id']}", json={"action": "vender"}, timeout=15)
    assert r.status_code == 200
    assert r.json()["status"] == "vendida"
    assert r.json()["sold_at"] is not None

    after = auth.get(f"{BASE_URL}/api/sales/summary", params={"month": month}, timeout=15).json()
    assert after["revenue"] >= before["revenue"] + 300.0 - 0.01

    _delete_sale(auth, sale["id"])


def test_condicional_return_restores_stock(auth, test_item):
    initial_qty = test_item["quantity"]
    payload = {
        "clothing_id": test_item["id"], "quantity": 2, "unit_price": 100.0,
        "type": "condicional", "client": "TEST_Cliente", "payment_method": "pix", "paid": False,
    }
    r = auth.post(f"{BASE_URL}/api/sales", json=payload, timeout=15)
    sale = r.json()
    r = auth.patch(f"{BASE_URL}/api/sales/{sale['id']}", json={"action": "devolver"}, timeout=15)
    assert r.status_code == 200
    assert r.json()["status"] == "devolvida"
    clothes = auth.get(f"{BASE_URL}/api/clothes", timeout=15).json()
    item = next(c for c in clothes if c["id"] == test_item["id"])
    assert item["quantity"] == initial_qty  # restored

    # Delete devolvida should NOT re-restore
    r = auth.delete(f"{BASE_URL}/api/sales/{sale['id']}", timeout=15)
    assert r.status_code == 200
    clothes = auth.get(f"{BASE_URL}/api/clothes", timeout=15).json()
    item = next(c for c in clothes if c["id"] == test_item["id"])
    assert item["quantity"] == initial_qty


def test_cannot_patch_action_on_non_condicional(auth, test_item):
    r = auth.post(f"{BASE_URL}/api/sales", json={
        "clothing_id": test_item["id"], "quantity": 1, "unit_price": 100.0,
        "type": "venda", "client": "TEST_Cliente", "payment_method": "pix", "paid": True,
    }, timeout=15).json()
    r2 = auth.patch(f"{BASE_URL}/api/sales/{r['id']}", json={"action": "vender"}, timeout=15)
    assert r2.status_code == 400
    _delete_sale(auth, r["id"])


# -------- Toggle paid & delete --------

def test_toggle_paid(auth, test_item):
    r = auth.post(f"{BASE_URL}/api/sales", json={
        "clothing_id": test_item["id"], "quantity": 1, "unit_price": 100.0,
        "type": "venda", "client": "TEST_Cliente", "payment_method": "pix", "paid": False,
    }, timeout=15).json()
    r2 = auth.patch(f"{BASE_URL}/api/sales/{r['id']}", json={"paid": True}, timeout=15)
    assert r2.status_code == 200
    assert r2.json()["paid"] is True
    _delete_sale(auth, r["id"])


def test_delete_sale_restores_stock(auth, test_item):
    initial_qty = test_item["quantity"]
    r = auth.post(f"{BASE_URL}/api/sales", json={
        "clothing_id": test_item["id"], "quantity": 2, "unit_price": 100.0,
        "type": "venda", "client": "TEST_Cliente", "payment_method": "pix", "paid": True,
    }, timeout=15).json()
    assert auth.delete(f"{BASE_URL}/api/sales/{r['id']}", timeout=15).status_code == 200
    clothes = auth.get(f"{BASE_URL}/api/clothes", timeout=15).json()
    item = next(c for c in clothes if c["id"] == test_item["id"])
    assert item["quantity"] == initial_qty


# -------- Regression smoke --------

def test_regression_clothes_and_finance(auth):
    r = auth.get(f"{BASE_URL}/api/clothes", timeout=15)
    assert r.status_code == 200
    r = auth.get(f"{BASE_URL}/api/finance/summary", timeout=15)
    assert r.status_code == 200
    assert "total_profit" in r.json()


def test_auth_me(auth):
    r = auth.get(f"{BASE_URL}/api/auth/me", timeout=15)
    assert r.status_code == 200
    assert r.json()["phone"] == PHONE
