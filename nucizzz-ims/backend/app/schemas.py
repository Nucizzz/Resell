from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class LocationCreate(BaseModel):
    name: str

class LocationOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    sku: str
    barcode: Optional[str] = None
    title: str
    brand: Optional[str] = None
    description: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    weight_grams: Optional[float] = None
    package_required: Optional[str] = None
    cost: Optional[float] = None
    price: Optional[float] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = True

class ProductCreate(ProductBase):
    initial_qty: Optional[int] = 0
    location_id: Optional[int] = None

class ReceiveCreate(BaseModel):
    barcode: str
    title: str
    description: Optional[str] = None
    size: Optional[str] = None
    price_eur: Optional[float] = None
    cost_eur: Optional[float] = None
    weight_g: Optional[float] = None
    package_required: Optional[str] = None
    location: Optional[str] = None
    image_url: Optional[str] = None

class ProductOut(ProductBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class StockOut(BaseModel):
    location_id: int
    qty: int

class MovementCreate(BaseModel):
    product_id: int
    type: str = Field(pattern="^(in|out|transfer|sell)$")
    qty_change: int
    from_location_id: Optional[int] = None
    to_location_id: Optional[int] = None
    note: Optional[str] = None

class MovementOut(BaseModel):
    id: int
    product_id: int
    type: str
    qty_change: int
    from_location_id: Optional[int]
    to_location_id: Optional[int]
    note: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True
