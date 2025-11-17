from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

import httpx

from json import dumps

from app.core.config import (
    HTTP_TIMEOUT,
    RAPIDAPI_HOST,
    RAPIDAPI_KEY,
    RAPIDAPI_PATH,
    RAPIDAPI_QUERY_PARAM,
)
from app.models.product_dto import ProductDTO


def _error(code: str, message: str, meta: Dict[str, Any]) -> Tuple[str, None, str, Dict[str, Any]]:
    meta.setdefault("error", message)
    return ("ERROR", None, f"{code}:{message}", meta)


async def lookup_rapidapi(
    barcode: str,
    want_meta: bool = False,
) -> Tuple[str, Optional[Dict[str, Any]], Optional[str], Dict[str, Any]]:
    meta: Dict[str, Any] = {
        "provider": "rapidapi",
        "route": RAPIDAPI_PATH,
        "host": RAPIDAPI_HOST,
        "source": "RAPIDAPI",
        "query_param": RAPIDAPI_QUERY_PARAM,
    }
    if not RAPIDAPI_KEY or not RAPIDAPI_HOST:
        return _error("INVALID_API_KEY", "RapidAPI key/host non configurati", meta)

    url = f"https://{RAPIDAPI_HOST}{RAPIDAPI_PATH}"
    params = {RAPIDAPI_QUERY_PARAM: barcode}
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            response = await client.get(url, params=params, headers=headers)
    except Exception as exc:  # pragma: no cover - runtime network failure
        return _error("NETWORK_ERROR", str(exc), meta)

    meta["http_status"] = response.status_code
    meta["url"] = str(response.request.url)

    if response.status_code == 404:
        if want_meta:
            meta["body_sample"] = response.text[:800]
        return ("ERROR", None, "ROUTE_NOT_FOUND:HTTP_404", meta)
    if response.status_code in (401, 403):
        if want_meta:
            meta["body_sample"] = response.text[:800]
        return _error("INVALID_API_KEY", "Chiave RapidAPI rifiutata", meta)
    if response.status_code == 429:
        if want_meta:
            meta["body_sample"] = response.text[:800]
        return _error("RATE_LIMIT", "Limite richieste superato", meta)
    if not response.is_success:
        if want_meta:
            meta["body_sample"] = response.text[:800]
        if response.status_code in (301, 302):
            return _error("ROUTE_NOT_FOUND", f"HTTP_{response.status_code}", meta)
        return _error("SERVER_ERROR", f"HTTP_{response.status_code}", meta)

    try:
        payload = response.json()
    except Exception:
        payload = {}

    if want_meta:
        try:
            meta["body_sample"] = dumps(payload, ensure_ascii=False)[:1200]
        except Exception:
            meta["body_sample"] = (response.text or "")[:1200]

    product: Optional[Dict[str, Any]] = None
    if isinstance(payload, dict):
        if isinstance(payload.get("product"), dict):
            product = payload["product"]
        elif isinstance(payload.get("result"), dict):
            product = payload["result"]
        elif isinstance(payload.get("items"), list) and payload["items"]:
            first_item = payload["items"][0]
            product = first_item if isinstance(first_item, dict) else None
        else:
            product = payload

    def pick(*keys: str):
        for key in keys:
            if isinstance(product, dict) and product.get(key):
                return product.get(key)
            if isinstance(payload, dict) and payload.get(key):
                return payload.get(key)
        return None

    name = pick("name", "title", "product_name")
    brand = pick("brand", "brands", "manufacturer")
    images = pick("images", "image_urls", "image", "image_url", "photos")
    if isinstance(images, str):
        images = [images]
    elif isinstance(images, list):
        images = [img for img in images if isinstance(img, str)]
    else:
        images = None

    if not any([name, brand, images]):
        return ("NOT_FOUND", None, None, meta)

    dto = ProductDTO(
        barcode=barcode,
        name=name,
        brand=brand,
        category=pick("category", "categories"),
        description=pick("description", "generic_name"),
        images=images,
        quantity=pick("quantity", "package_size"),
        packaging=pick("packaging", "container"),
        countryOrigin=pick("origin", "country", "countries"),
        attributes=pick("attributes", "specs", "extra"),
        source="RAPIDAPI",
        raw=payload,
    )
    return ("FOUND", dto.model_dump(), None, meta)
