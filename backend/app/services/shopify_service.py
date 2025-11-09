from __future__ import annotations

import logging
from typing import Any

import httpx

from ..core.settings import get_settings
from ..models import Product

logger = logging.getLogger(__name__)


class ShopifyService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = (
            f"https://{self.settings.shopify_store_domain}/admin/api/{self.settings.shopify_api_version}"
        )
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "X-Shopify-Access-Token": self.settings.shopify_access_token,
                "Content-Type": "application/json",
            },
            timeout=20.0,
        )

    async def __aenter__(self) -> "ShopifyService":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:  # type: ignore[override]
        await self.client.aclose()

    async def create_product(self, product: Product) -> dict[str, Any]:
        payload = {
            "product": {
                "title": product.name,
                "body_html": f"<strong>Brand:</strong> {product.brand or 'N/A'}",
                "vendor": product.brand or "Nucizzz",
                "product_type": "Resell",
                "tags": [product.condition, product.size or "unsized"],
                "variants": [
                    {
                        "sku": product.sku,
                        "barcode": product.barcode,
                        "price": str(product.sale_price or "0.00"),
                        "inventory_management": "shopify",
                        "inventory_policy": "deny",
                    }
                ],
            }
        }
        response = await self.client.post("/products.json", json=payload)
        response.raise_for_status()
        return response.json()

    async def adjust_inventory(self, inventory_item_id: str, available_adjustment: int) -> None:
        payload = {
            "inventory_item_id": inventory_item_id,
            "location_id": self.settings.shopify_location_id,
            "available_adjustment": available_adjustment,
        }
        response = await self.client.post("/inventory_levels/adjust.json", json={"inventory_level": payload})
        response.raise_for_status()


async def push_product_to_shopify(product: Product) -> dict[str, Any]:
    async with ShopifyService() as service:
        data = await service.create_product(product)
        try:
            variant = data["product"]["variants"][0]
        except (KeyError, IndexError) as exc:
            logger.error("Unexpected Shopify payload: %s", data)
            raise ValueError("Invalid Shopify response") from exc
        await service.adjust_inventory(variant["inventory_item_id"], 1)
        return {
            "product_id": data["product"]["id"],
            "inventory_item_id": variant["inventory_item_id"],
        }


async def mark_product_sold(product: Product) -> None:
    if not product.shopify_inventory_item_id:
        logger.warning("Product %s has no Shopify inventory item id", product.id)
        return
    async with ShopifyService() as service:
        await service.adjust_inventory(product.shopify_inventory_item_id, -1)
