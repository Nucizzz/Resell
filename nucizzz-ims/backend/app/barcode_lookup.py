import httpx
from typing import Optional

from .config import settings

async def lookup_barcode(barcode: str) -> dict:
    # Try OpenFoodFacts
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json")
            if r.status_code == 200:
                data = r.json()
                if data.get("status") == 1:
                    p = data.get("product", {})
                    return {
                        "name": p.get("product_name") or p.get("generic_name") or "",
                        "brand": (p.get("brands") or "").split(",")[0].strip() if p.get("brands") else None,
                        "category": (p.get("categories") or "").split(",")[0].strip() if p.get("categories") else None,
                        "image_url": p.get("image_url") or p.get("image_front_url"),
                        "source": "openfoodfacts"
                    }
    except Exception:
        pass

    # Try BarcodeLookup if key available
    if settings.barcodelookup_api_key:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get("https://api.barcodelookup.com/v3/products", params={
                    "barcode": barcode,
                    "key": settings.barcodelookup_api_key
                })
                if r.status_code == 200:
                    data = r.json()
                    products = data.get("products", [])
                    if products:
                        p = products[0]
                        return {
                            "name": p.get("product_name") or p.get("title"),
                            "brand": p.get("brand"),
                            "category": p.get("category"),
                            "image_url": (p.get("images") or [None])[0],
                            "source": "barcodelookup"
                        }
        except Exception:
            pass

    return {"name": "", "source": None}