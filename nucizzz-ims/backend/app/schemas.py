from pydantic import BaseModel

class ProductCreate(BaseModel):
    barcode: str
    title: str
    size: str
    price_eur: float

class ProductOut(BaseModel):
    id: int
    barcode: str
    title: str
    size: str
    price_eur: float
    available: bool
    shopify_product_id: str | None = None
    shopify_variant_id: str | None = None
    shopify_inventory_item_id: str | None = None

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            barcode=obj.barcode,
            title=obj.title,
            size=obj.size,
            price_eur=obj.price_cents / 100.0,
            available=obj.available,
            shopify_product_id=obj.shopify_product_id,
            shopify_variant_id=obj.shopify_variant_id,
            shopify_inventory_item_id=obj.shopify_inventory_item_id,
        )

class SellRequest(BaseModel):
    barcode: str

class ShopifySetupRequest(BaseModel):
    shop: str
    access_token: str
    location_id: str | None = None

class ShopifySetupOut(BaseModel):
    location_id: str
