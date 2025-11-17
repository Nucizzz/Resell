from __future__ import annotations

import asyncio
import json
import os
import sys
from typing import Any, Dict

import httpx

BARCODE_TEST = os.getenv("BARCODE_TEST", "198481505647")
EXPECTED_HOST = "barcodes-lookup.p.rapidapi.com"
EXPECTED_PATH = "/"
EXPECTED_PARAM = "barcode"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"OK: {msg}")


async def check_env() -> Dict[str, str]:
    required = ["RAPIDAPI_KEY", "RAPIDAPI_HOST", "RAPIDAPI_PATH", "RAPIDAPI_QUERY_PARAM"]
    values = {k: os.getenv(k, "") for k in required}
    missing = [k for k, v in values.items() if not v]
    if missing:
        fail(f"Variabili mancanti: {', '.join(missing)}")
    if values["RAPIDAPI_HOST"] != EXPECTED_HOST:
        fail(f"RAPIDAPI_HOST inatteso: {values['RAPIDAPI_HOST']} (atteso: {EXPECTED_HOST})")
    if values["RAPIDAPI_PATH"] != EXPECTED_PATH:
        fail(f"RAPIDAPI_PATH inatteso: {values['RAPIDAPI_PATH']} (atteso: {EXPECTED_PATH})")
    if values["RAPIDAPI_QUERY_PARAM"] != EXPECTED_PARAM:
        fail(f"RAPIDAPI_QUERY_PARAM inatteso: {values['RAPIDAPI_QUERY_PARAM']} (atteso: {EXPECTED_PARAM})")
    ok("ENV: host/path/param coerenti")
    return values


async def check_rapidapi_direct(env: Dict[str, str]) -> Dict[str, Any]:
    url = f"https://{env['RAPIDAPI_HOST']}{env['RAPIDAPI_PATH']}"
    params = {env["RAPIDAPI_QUERY_PARAM"]: BARCODE_TEST}
    headers = {
        "X-RapidAPI-Key": env["RAPIDAPI_KEY"],
        "X-RapidAPI-Host": env["RAPIDAPI_HOST"],
        "Accept": "application/json",
    }
    timeout = float(os.getenv("HTTP_TIMEOUT", "6.0"))
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(url, params=params, headers=headers)
    if response.status_code != 200:
        fail(f"RapidAPI HTTP {response.status_code}. Body: {response.text[:300]}")
    try:
        payload = response.json()
    except Exception:
        fail("RapidAPI: risposta non-JSON")
    if not isinstance(payload, dict) or "product" not in payload or not isinstance(payload["product"], dict):
        fail("RapidAPI: manca 'product' dict nel JSON")
    product = payload["product"]
    if not any([product.get("title"), product.get("brand"), product.get("images")]):
        fail("RapidAPI: product senza title/brand/images significativi")
    ok("RapidAPI: risposta valida e campi attesi presenti")
    return payload


async def check_backend_endpoint() -> Dict[str, Any]:
    base = os.getenv("BACKEND_BASE", "http://localhost:8000")
    url = f"{base}/api/barcode/{BARCODE_TEST}?nocache=1&debug=1"
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(url)
    if response.status_code != 200:
        fail(f"Backend HTTP {response.status_code}: {response.text[:300]}")
    try:
        payload = response.json()
    except Exception:
        fail("Backend: risposta non-JSON")
    if payload.get("status") != "FOUND":
        fail(f"Backend: status {payload.get('status')} (atteso FOUND)")
    data = payload.get("data") or {}
    if data.get("source") != "RAPIDAPI":
        fail(f"Backend: data.source={data.get('source')} (atteso RAPIDAPI)")
    images = data.get("images") or []
    if not (data.get("name") or data.get("brand") or images):
        fail("Backend: data priva di name/brand/images")
    if not images:
        print("ATTENZIONE: backend data.images vuoto")
    ok("Backend: endpoint /api/barcode/{code} risponde con FOUND e dati minimi")
    return payload


async def main() -> None:
    print("=== Verifica integrazione Barcode ===")
    env = await check_env()
    rapid_payload = await check_rapidapi_direct(env)
    backend_payload = await check_backend_endpoint()

    product = rapid_payload.get("product", {})
    backend_name = (backend_payload.get("data") or {}).get("name")
    title = product.get("title")

    if title and backend_name and title.casefold() != backend_name.casefold():
        print(
            "ATTENZIONE: name backend ≠ title RapidAPI\n"
            f"  backend: {backend_name}\n"
            f"  rapidapi: {title}"
        )
    else:
        ok("Mappatura name/title coerente (o non presente)")

    backend_debug = backend_payload.get("debug") or {}
    if backend_debug:
        sample = backend_debug.get("body_sample")
        if sample:
            clipped = sample[:200].replace("\n", " ")
            print(f"DEBUG sample (prime 200 ch): {clipped}")

    print("\nTutto pronto. ✅")
    sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
