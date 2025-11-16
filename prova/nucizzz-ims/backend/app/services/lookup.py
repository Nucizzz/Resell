from __future__ import annotations

import logging
import time
from typing import Any, Literal, Optional

from ..core.config import settings
from ..schemas.product import ProductEnrichment
from ..utils.cache import cache_get, cache_set
from ..utils.gtin import normalize_gtin_for_lookup
from ..utils.http import try_fetch_json, try_fetch_json_with_headers

logger = logging.getLogger(__name__)

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


def _pick(obj: dict[str, Any], keys: list[str]) -> Optional[str]:
    for key in keys:
        value = obj.get(key)
        if value:
            return str(value)
    return None


def _map_rapid(response: dict[str, Any], gtin: str) -> Optional[ProductEnrichment]:
    candidate: Optional[dict[str, Any]] = None
    products = response.get("products")
    if isinstance(products, list) and products:
        first = products[0]
        if isinstance(first, dict):
            candidate = first
    if candidate is None:
        item = response.get("item") or response.get("result")
        if isinstance(item, dict):
            candidate = item
    if candidate is None and isinstance(response, dict):
        candidate = response
    if not isinstance(candidate, dict):
        return None

    title = _pick(candidate, ["title", "name", "product_title", "product_name"]) or ""
    brand = _pick(candidate, ["brand", "manufacturer", "brand_name"]) or ""
    category = _pick(candidate, ["category", "category_name"]) or ""
    description = _pick(candidate, ["description", "short_description", "long_description"]) or ""
    image = _pick(candidate, ["image", "image_url", "imageurl", "thumbnail"])
    if not image:
        images = candidate.get("images")
        if isinstance(images, list) and images:
            first_img = images[0]
            if isinstance(first_img, str):
                image = first_img
            elif isinstance(first_img, dict):
                image = first_img.get("url") or first_img.get("link")

    if not any([title, brand, category, description, image]):
        return None

    return ProductEnrichment(
        found=True,
        source="RAPID",
        gtin=gtin,
        title=title or None,
        brand=brand or None,
        categories=[category] if category else None,
        image={"url": image} if image else None,
        description=description or None,
        raw=candidate,
    )


async def rapid_try(gtin: str) -> Optional[dict[str, Any]]:
    host = settings.RAPIDAPI_HOST
    key = settings.RAPIDAPI_KEY
    if not host or not key:
        logger.debug("RapidAPI disabled (missing host/key)")
        return None
    headers = {
        "x-rapidapi-host": host,
        "x-rapidapi-key": key,
    }
    urls = [
        f"https://{host}/?barcode={gtin}",
        f"https://{host}/?query={gtin}",
    ]
    for url in urls:
        data = await try_fetch_json_with_headers(url, headers, timeout_ms=settings.LOOKUP_TIMEOUT_MS)
        if data:
            logger.info("RapidAPI hit url=%s gtin=%s", url, gtin)
            return data
        logger.debug("RapidAPI miss url=%s gtin=%s", url, gtin)
    return None


async def lookup_product(gtin_raw: str, *, use_cache: bool = True, debug: bool = False) -> ProductEnrichment:
    started = time.perf_counter()
    gtin_normalized = normalize_gtin_for_lookup(gtin_raw)
    cache_key = f"lookup:{gtin_normalized}"
    if debug:
        logger.info("lookup debug raw=%s normalized=%s use_cache=%s", gtin_raw, gtin_normalized, use_cache)

    if use_cache:
        cached = await cache_get(cache_key)
        if cached:
            logger.info("lookup cache hit gtin=%s source=%s", gtin_normalized, cached.get("source"))
            return ProductEnrichment(**cached)

    for name, pattern in SOURCES_OPEN:
        url = pattern.format(gtin=gtin_normalized)
        data = await try_fetch_json(url, timeout_ms=settings.LOOKUP_TIMEOUT_MS)
        if data and data.get("status") == 1 and data.get("product"):
            enrichment = map_open_product(data["product"], name, gtin_normalized)
            if use_cache:
                await cache_set(cache_key, enrichment.model_dump(), settings.LOOKUP_TTL_SECONDS)
            elapsed = (time.perf_counter() - started) * 1000
            logger.info("lookup gtin=%s source=%s ms=%.2f", gtin_normalized, name, elapsed)
            return enrichment

    gtin_candidates = [gtin_normalized]
    if gtin_raw != gtin_normalized:
        gtin_candidates.append(gtin_raw)

    for candidate in gtin_candidates:
        rapid_response = await rapid_try(candidate)
        if rapid_response:
            mapped = _map_rapid(rapid_response, candidate)
            if mapped and mapped.found:
                if use_cache:
                    await cache_set(cache_key, mapped.model_dump(), settings.LOOKUP_TTL_SECONDS)
                elapsed = (time.perf_counter() - started) * 1000
                logger.info("lookup gtin=%s source=RAPID ms=%.2f", candidate, elapsed)
                return mapped

    not_found = ProductEnrichment(found=False, source=None, gtin=gtin_normalized, raw=None)
    if use_cache:
        await cache_set(cache_key, not_found.model_dump(), settings.LOOKUP_TTL_SECONDS)
    elapsed = (time.perf_counter() - started) * 1000
    logger.info("lookup gtin=%s source=NONE ms=%.2f", gtin_normalized, elapsed)
    return not_found
