from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, Optional, Tuple

from app.core.config import CACHE_TTL, OPEN_TIMEOUT
from app.integrations.barcode.open.open_product_data import lookup_open_product_data
from app.integrations.barcode.open.openfoodfacts import lookup_openfoodfacts
from app.integrations.barcode.rapidapi.client import lookup_rapidapi

logger = logging.getLogger(__name__)

CacheEntry = Tuple[float, Dict[str, Any]]
_CACHE: Dict[str, CacheEntry] = {}


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    now = time.time()
    payload = _CACHE.get(key)
    if not payload:
        return None
    expiry, data = payload
    if now > expiry:
        _CACHE.pop(key, None)
        return None
    return data


def _cache_set(key: str, payload: Dict[str, Any]) -> None:
    _CACHE[key] = (time.time() + CACHE_TTL, payload)


def validate_barcode(code: str) -> bool:
    """Valida formati EAN/UPC/GTIN (8/12/13/14 cifre, check digit opzionale)."""
    return code.isdigit() and len(code) in (8, 12, 13, 14)


async def _query_open_providers(
    barcode: str,
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    providers = [lookup_openfoodfacts, lookup_open_product_data]
    tasks = [asyncio.create_task(provider(barcode, OPEN_TIMEOUT)) for provider in providers]
    open_meta: Optional[Dict[str, Any]] = None
    first_error: Optional[str] = None
    first_error_meta: Optional[Dict[str, Any]] = None
    not_found_count = 0

    try:
        for task in asyncio.as_completed(tasks, timeout=OPEN_TIMEOUT):
            try:
                status, dto, err, meta = await task
            except Exception as exc:  # pragma: no cover - defensive
                status, dto, err, meta = ("ERROR", None, f"OPEN_ERROR:{exc}", {"provider": "open", "source": "OPEN"})

            if status == "FOUND" and dto:
                open_meta = meta
                return {"status": "FOUND", "data": dto}, open_meta
            if status == "NOT_FOUND":
                not_found_count += 1
                open_meta = meta
            elif status == "ERROR" and not first_error:
                first_error = err
                first_error_meta = meta
    except asyncio.TimeoutError:
        logger.warning(
            "barcode_lookup_open_timeout",
            extra={"event": "barcode_lookup_open_timeout", "barcode": barcode, "timeout": OPEN_TIMEOUT},
        )
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()

    if not_found_count == len(providers):
        return {"status": "NOT_FOUND", "reason": "OPEN_EMPTY"}, open_meta
    if first_error:
        code, message = first_error.split(":", 1) if ":" in first_error else ("OPEN_ERROR", first_error or "Unknown")
        return {"status": "ERROR", "code": code, "message": message}, first_error_meta
    return None, open_meta


async def lookup_barcode(barcode: str, nocache: bool = False, debug: bool = False) -> Dict[str, Any]:
    cache_key = f"barcode:{barcode}"
    use_cache = not nocache and not debug
    if use_cache:
        if cached := _cache_get(cache_key):
            return cached

    start = time.perf_counter()
    final_meta: Dict[str, Any] = {}

    open_result, open_meta = await _query_open_providers(barcode)
    if open_meta:
        final_meta.update(open_meta)

    if open_result and open_result["status"] == "FOUND":
        if use_cache:
            _cache_set(cache_key, open_result)
        _log_result(barcode, open_result, final_meta, start)
        return open_result
    if open_result and open_result["status"] == "ERROR":
        logger.warning(
            "barcode_lookup_open_error",
            extra={
                "event": "barcode_lookup_open_error",
                "barcode": barcode,
                "code": open_result.get("code"),
                "message": open_result.get("message"),
                "provider": (open_meta or {}).get("provider"),
            },
        )

    # Proseguiamo con RapidAPI indipendentemente dal risultato open (anche in caso di errore)
    rapid_status, rapid_dto, rapid_err, rapid_meta = await lookup_rapidapi(barcode, want_meta=debug)
    if rapid_meta:
        final_meta.update(rapid_meta)

    if rapid_status == "FOUND" and rapid_dto:
        payload = {"status": "FOUND", "data": rapid_dto}
        if debug and rapid_meta:
            payload["debug"] = rapid_meta
        if use_cache:
            cache_payload = {k: v for k, v in payload.items() if k != "debug"}
            _cache_set(cache_key, cache_payload)
        _log_result(barcode, payload, final_meta, start)
        return payload

    if rapid_status == "NOT_FOUND":
        payload = {"status": "NOT_FOUND", "reason": "RAPIDAPI_EMPTY"}
        if debug and rapid_meta:
            payload["debug"] = rapid_meta
        if use_cache:
            cache_payload = {k: v for k, v in payload.items() if k != "debug"}
            _cache_set(cache_key, cache_payload)
        _log_result(barcode, payload, final_meta, start)
        return payload

    # RapidAPI errore → ritorna dettaglio
    code, message = (
        rapid_err.split(":", 1) if rapid_err and ":" in rapid_err else ("UNKNOWN", rapid_err or "Unexpected error")
    )
    payload = {"status": "ERROR", "code": code, "message": message}
    if debug and rapid_meta:
        payload["debug"] = rapid_meta
    _log_result(barcode, payload, final_meta, start)
    return payload


def _log_result(barcode: str, result: Dict[str, Any], meta: Dict[str, Any], start: float) -> None:
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    status = result.get("status")
    source = None
    if status == "FOUND":
        source = result["data"].get("source")
    elif status == "NOT_FOUND":
        source = meta.get("source") or ("RAPIDAPI" if result.get("reason") == "RAPIDAPI_EMPTY" else "OPEN")
    else:
        source = meta.get("source")

    logger.info(
        "barcode_lookup",
        extra={
            "event": "barcode_lookup",
            "barcode": barcode,
            "status": status,
            "source": source,
            "route": meta.get("route"),
            "provider": meta.get("provider"),
            "http_status": meta.get("http_status"),
            "duration_ms": duration_ms,
        },
    )
