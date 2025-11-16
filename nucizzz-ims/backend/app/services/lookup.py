from __future__ import annotations

import logging
import time
from os import getenv
from typing import Any, Literal, Optional

from ..schemas.product import ProductEnrichment
from ..utils.cache import cache_get, cache_set
from ..utils.gtin import normalize_gtin_for_lookup
from ..utils.http import try_fetch_json

logger = logging.getLogger(__name__)

LOOKUP_TIMEOUT_MS = int(getenv("LOOKUP_TIMEOUT_MS", "5000"))
LOOKUP_TTL_SECONDS = int(getenv("LOOKUP_TTL_SECONDS", "604800"))
BARCODE_SPIDER_TOKEN = getenv("BARCODE_SPIDER_TOKEN", "")

SOURCES_OPEN = [
    ("OFF", "https://world.openfoodfacts.org/api/v2/product/{gtin}.json"),
    ("OBF", "https://world.openbeautyfacts.org/api/v2/product/{gtin}.json"),
    ("OPF", "https://world.openproductdata.org/api/v2/product/{gtin}.json"),
]


def _split_categories(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(v) for v in value if v]
    return [part.strip() for part in str(value).split(",") if part.strip()]


def map_open_product(payload: dict[str, Any], source: Literal["OFF", "OBF", "OPF"], gtin: str) -> ProductEnrichment:
    title = (
        payload.get("product_name")
        or payload.get("generic_name")
        or payload.get("product_name_en")
        or payload.get("product_name_it")
        or ""
    )
    brand_raw = (payload.get("brands") or "").split(",")
    brand = brand_raw[0].strip() if brand_raw and brand_raw[0] else ""
    categories = _split_categories(payload.get("categories_tags") or payload.get("categories"))
    image = (
        payload.get("image_url")
        or payload.get("image_front_url")
        or payload.get("image_small_url")
        or payload.get("image")
    )
    description = payload.get("ingredients_text") or payload.get("comment") or payload.get("description") or ""
    credits = payload.get("creator") or payload.get("photographers") or payload.get("source") or payload.get("image_license")
    return ProductEnrichment(
        found=True,
        source=source,
        gtin=gtin,
        title=title or None,
        brand=brand or None,
        categories=categories or None,
        image={"url": image, "credits": credits} if image else None,
        description=description or None,
        raw=payload,
    )


def map_spider_product(response: dict[str, Any], gtin: str) -> Optional[ProductEnrichment]:
    def pick(obj: Any, keys: list[str]) -> Optional[str]:
        if not obj:
            return None
        for key in keys:
            value = obj.get(key) if isinstance(obj, dict) else None
            if value:
                return str(value)
        return None

    candidate = (
        response.get("item_attributes")
        or response.get("item")
        or (response.get("products") or [None])[0]
        or response
    )
    if not isinstance(candidate, dict):
        return None

    title = pick(candidate, ["title", "name"])
    brand = pick(candidate, ["brand", "manufacturer"])
    category = pick(candidate, ["category", "category_name"])
    description = pick(candidate, ["description", "short_description", "long_description"])

    image_url = None
    images = response.get("item_images")
    if isinstance(images, list) and images:
        first = images[0]
        if isinstance(first, dict):
            image_url = first.get("link") or first.get("url")
    image_url = image_url or pick(candidate, ["imageurl", "image_url", "image"])

    return ProductEnrichment(
        found=True,
        source="SPIDER",
        gtin=gtin,
        title=title,
        brand=brand,
        categories=[category] if category else None,
        image={"url": image_url} if image_url else None,
        description=description,
        raw=candidate,
    )


async def lookup_product(gtin_raw: str) -> ProductEnrichment:
    started = time.perf_counter()
    gtin = normalize_gtin_for_lookup(gtin_raw)
    cache_key = f"lookup:{gtin}"

    cached = await cache_get(cache_key)
    if cached:
        logger.info("lookup cache hit gtin=%s source=%s", gtin, cached.get("source"))
        return ProductEnrichment(**cached)

    for name, pattern in SOURCES_OPEN:
        url = pattern.format(gtin=gtin)
        data = await try_fetch_json(url, timeout_ms=LOOKUP_TIMEOUT_MS)
        if data and data.get("status") == 1 and data.get("product"):
            enrichment = map_open_product(data["product"], name, gtin)
            await cache_set(cache_key, enrichment.model_dump(), LOOKUP_TTL_SECONDS)
            elapsed = (time.perf_counter() - started) * 1000
            logger.info("lookup gtin=%s source=%s ms=%.2f", gtin, name, elapsed)
            return enrichment

    if BARCODE_SPIDER_TOKEN:
        spider_url = (
            "https://api.barcodespider.com/v1/lookup"
            f"?token={BARCODE_SPIDER_TOKEN}&upc={gtin}"
        )
        data = await try_fetch_json(spider_url, timeout_ms=LOOKUP_TIMEOUT_MS)
        if data:
            mapped = map_spider_product(data, gtin)
            if mapped and mapped.found:
                await cache_set(cache_key, mapped.model_dump(), LOOKUP_TTL_SECONDS)
                elapsed = (time.perf_counter() - started) * 1000
                logger.info("lookup gtin=%s source=SPIDER ms=%.2f", gtin, elapsed)
                return mapped

    not_found = ProductEnrichment(found=False, source=None, gtin=gtin, raw=None)
    await cache_set(cache_key, not_found.model_dump(), LOOKUP_TTL_SECONDS)
    elapsed = (time.perf_counter() - started) * 1000
    logger.info("lookup gtin=%s source=NONE ms=%.2f", gtin, elapsed)
    return not_found

