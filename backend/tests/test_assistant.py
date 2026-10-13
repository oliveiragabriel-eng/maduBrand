"""Tests for Madu Brand AI Assistant (Gemini) endpoints."""
import json
import os
import time

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # fallback: read frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

PHONE = os.environ.get("TEST_ADMIN_PHONE", "")
PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "")


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"phone": PHONE, "password": PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def test_item(headers):
    """Create a TEST_ item with known numbers, yield id, then delete."""
    payload = {
        "name": "TEST_AssistantProfitItem",
        "size": "M",
        "color": "preto",
        "cost": 10.0,
        "price": 50.0,
        "quantity": 3,
    }  # expected unit profit 40, total profit 120
    r = requests.post(f"{BASE_URL}/api/clothes", json=payload, headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    iid = r.json()["id"]
    yield payload, iid
    requests.delete(f"{BASE_URL}/api/clothes/{iid}", headers=headers, timeout=15)


# --- Auth guards ---
def test_messages_requires_auth():
    r = requests.get(f"{BASE_URL}/api/assistant/messages", timeout=10)
    assert r.status_code == 401


def test_chat_requires_auth():
    r = requests.post(f"{BASE_URL}/api/assistant/chat", json={"message": "oi"}, timeout=10)
    assert r.status_code == 401


def test_clear_requires_auth():
    r = requests.delete(f"{BASE_URL}/api/assistant/messages", timeout=10)
    assert r.status_code == 401


# --- History get/clear baseline ---
def test_clear_then_messages_empty(headers):
    requests.delete(f"{BASE_URL}/api/assistant/messages", headers=headers, timeout=10)
    r = requests.get(f"{BASE_URL}/api/assistant/messages", headers=headers, timeout=10)
    assert r.status_code == 200
    assert r.json() == []


# --- Chat SSE streaming with real data ---
def _consume_sse(resp, timeout=60):
    """Parse SSE stream and return concatenated delta text."""
    text = ""
    start = time.time()
    for raw in resp.iter_lines(decode_unicode=True):
        if time.time() - start > timeout:
            break
        if not raw:
            continue
        if raw.startswith("data: "):
            data = raw[6:]
            if data == "[DONE]":
                return text, None
            try:
                parsed = json.loads(data)
            except Exception:
                continue
            if "error" in parsed:
                return text, parsed["error"]
            if "delta" in parsed:
                text += parsed["delta"]
    return text, None


def test_chat_streams_and_uses_real_data(headers, test_item):
    item, _iid = test_item
    # clear history for clean slate
    requests.delete(f"{BASE_URL}/api/assistant/messages", headers=headers, timeout=10)

    question = (
        f"Qual o lucro total da peca '{item['name']}'? Responda apenas com o numero em reais."
    )
    with requests.post(
        f"{BASE_URL}/api/assistant/chat",
        json={"message": question},
        headers=headers,
        stream=True,
        timeout=90,
    ) as r:
        assert r.status_code == 200
        assert "text/event-stream" in r.headers.get("content-type", "")
        reply, err = _consume_sse(r, timeout=60)

    assert err is None, f"Stream error: {err}"
    assert len(reply) > 0, "Empty assistant reply"
    print(f"Assistant reply: {reply[:400]}")
    # Should mention 120 (total profit) given cost=10, price=50, qty=3
    assert "120" in reply, f"Expected '120' in reply, got: {reply!r}"


def test_history_persists_and_clears(headers):
    # After previous test, history should have at least 1 user + 1 assistant message
    r = requests.get(f"{BASE_URL}/api/assistant/messages", headers=headers, timeout=10)
    assert r.status_code == 200
    msgs = r.json()
    assert len(msgs) >= 2
    roles = [m["role"] for m in msgs]
    assert "user" in roles and "assistant" in roles

    # Clear
    r = requests.delete(f"{BASE_URL}/api/assistant/messages", headers=headers, timeout=10)
    assert r.status_code == 200
    r = requests.get(f"{BASE_URL}/api/assistant/messages", headers=headers, timeout=10)
    assert r.json() == []
