from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

import httpx

from app.models.product_dto import ProductDTO

BASE_URL = "https://world.openfoodfacts.org/api/v0/product"


async def lookup_openfoodfacts(
    barcode: str, timeout: float
) -> Tuple[str, Optional[Dict[str, Any]], Optional[str], Dict[str, Any]]:
    url = f"{BASE_URL}/{barcode}.json"
    meta: Dict[str, Any] = {"provider": "openfoodfacts", "route": url, "source": "OPEN"}
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url)
        meta["http_status"] = response.status_code
    except Exception as exc:  # pragma: no cover - network failures are runtime only
        meta["error"] = str(exc)
        return ("ERROR", None, f"NETWORK_ERROR:{exc}", meta)

    if response.status_code == 404:
        return ("NOT_FOUND", None, None, meta)
    if not response.is_success:
        return ("ERROR", None, f"SERVER_ERROR:HTTP_{response.status_code}", meta)

    data = response.json()
    if not data or data.get("status") != 1:
        return ("NOT_FOUND", None, None, meta)

    product = data.get("product") or {}
    images = [
        product.get("image_url"),
        product.get("image_front_url"),
        product.get("image_small_url"),
    ]
    filtered_images = [img for img in images if img]

    dto = ProductDTO(
        barcode=barcode,
        name=product.get("product_name"),
        brand=product.get("brands"),
        category=product.get("categories"),
        description=product.get("generic_name"),
        images=filtered_images or None,
        quantity=product.get("quantity"),
        packaging=product.get("packaging"),
        countryOrigin=product.get("countries"),
        attributes={
            "nutriscore": product.get("nutriscore_grade"),
            "ecoscore": product.get("ecoscore_grade"),
        },
        source="OPEN",
        raw=data,
    )
    meta["http_status"] = 200
    return ("FOUND", dto.model_dump(), None, meta)
