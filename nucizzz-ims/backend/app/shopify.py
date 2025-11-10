import httpx
import os
from typing import Optional
from .models import Product

class ShopifyError(Exception):
    pass

class ShopifyClient:
    def __init__(self, shop: str, access_token: str, default_location_id: Optional[str] = None):
        if not shop or not access_token:
            raise ShopifyError("Config Shopify mancante: shop o token vuoti")
        self.shop = shop
        self.token = access_token
        self.api_base = f"https://{shop}/admin/api/2024-10"
        self.location_id = default_location_id

    def _headers(self):
        return {
            "X-Shopify-Access-Token": self.token,
            "Content-Type": "application/json"
        }

    def ensure_location(self, location_id: Optional[str]) -> str:
        if location_id:
            return location_id
        # fetch first active location
        url = f"{self.api_base}/locations.json"
        r = httpx.get(url, headers=self._headers(), timeout=30)
        if r.status_code >= 300:
            raise ShopifyError(f"Errore location: {r.text}")
        data = r.json()
        locs = data.get("locations", [])
        if not locs:
            raise ShopifyError("Nessuna location attiva trovata su Shopify")
        self.location_id = str(locs[0]["id"])
        return self.location_id

    def upsert_product(self, p: Product):
        # if product linked, update; else create
        if p.shopify_product_id and p.shopify_variant_id:
            # update price/title
            url = f"{self.api_base}/products/{p.shopify_product_id}.json"
            body = {
                "product": {
                    "id": int(p.shopify_product_id),
                    "title": p.title,
                    "variants": [{
                        "id": int(p.shopify_variant_id),
                        "price": f"{p.price_cents/100:.2f}",
                        "sku": p.barcode,
                        "option1": p.size
                    }]
                }
            }
            r = httpx.put(url, headers=self._headers(), json=body, timeout=30)
            if r.status_code >= 300:
                raise ShopifyError(f"Update product failed: {r.text}")
            return

        # create new product
        url = f"{self.api_base}/products.json"
        body = {
            "product": {
                "title": p.title,
                "body_html": f"Taglia: {p.size}",
                "status": "active",
                "variants": [{
                    "price": f"{p.price_cents/100:.2f}",
                    "sku": p.barcode,
                    "inventory_management": "shopify",
                    "option1": p.size
                }],
                "options": [{"name": "Size"}]
            }
        }
        r = httpx.post(url, headers=self._headers(), json=body, timeout=30)
        if r.status_code >= 300:
            raise ShopifyError(f"Create product failed: {r.text}")
        data = r.json()["product"]
        p.shopify_product_id = str(data["id"])
        variant = data["variants"][0]
        p.shopify_variant_id = str(variant["id"])
        p.shopify_inventory_item_id = str(variant["inventory_item_id"])

    def set_inventory(self, p: Product, quantity: int):
        loc = self.location_id or self.ensure_location(self.location_id)
        if not p.shopify_inventory_item_id:
            # fetch variant to get inventory item id
            if not p.shopify_variant_id:
                raise ShopifyError("Variant non impostata per l'articolo")
            vurl = f"{self.api_base}/variants/{p.shopify_variant_id}.json"
            vr = httpx.get(vurl, headers=self._headers(), timeout=30)
            if vr.status_code >= 300:
                raise ShopifyError(f"Variant fetch failed: {vr.text}")
            p.shopify_inventory_item_id = str(vr.json()["variant"]["inventory_item_id"])

        # set inventory level
        url = f"{self.api_base}/inventory_levels/set.json"
        body = {
            "location_id": int(loc),
            "inventory_item_id": int(p.shopify_inventory_item_id),
            "available": quantity
        }
        r = httpx.post(url, headers=self._headers(), json=body, timeout=30)
        if r.status_code >= 300:
            raise ShopifyError(f"Inventory set failed: {r.text}")
