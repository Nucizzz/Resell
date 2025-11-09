from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProductBase(BaseModel):
    sku: str = Field(..., description="Internal SKU or stock number")
    barcode: str = Field(..., description="Barcode or QR code scanned from the product")
    name: str
    brand: Optional[str] = None
    size: Optional[str] = None
    colorway: Optional[str] = None
    condition: str = "new"
    cost_price: Optional[float] = None
    sale_price: Optional[float] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    size: Optional[str] = None
    colorway: Optional[str] = None
    condition: Optional[str] = None
    cost_price: Optional[float] = None
    sale_price: Optional[float] = None
    listed: Optional[bool] = None
    is_sold: Optional[bool] = None
    shopify_product_id: Optional[str] = None
    shopify_inventory_item_id: Optional[str] = None


class ProductRead(ProductBase):
    id: int
    listed: bool
    is_sold: bool
    shopify_product_id: Optional[str]
    shopify_inventory_item_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
