from pydantic import BaseModel
from typing import Optional

class ProductCreate(BaseModel):
    barcode: str
    title: str
    description: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    colorway: Optional[str] = None
    category: Optional[str] = "sneakers"
    tags: Optional[str] = None
    size: Optional[str] = None
    condition: Optional[str] = "new"
    sku: Optional[str] = None
    cost_eur: float = 0
    price_eur: float = 0
    weight_grams: Optional[int] = None
    package_required: bool = False
    image_url: Optional[str] = None
    quantity: int = 1
    location_id: Optional[int] = None

class ProductUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    colorway: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[str] = None
    size: Optional[str] = None
    condition: Optional[str] = None
    sku: Optional[str] = None
    cost_eur: Optional[float] = None
    price_eur: Optional[float] = None
    weight_grams: Optional[int] = None
    package_required: Optional[bool] = None
    image_url: Optional[str] = None
    quantity: Optional[int] = None
    location_id: Optional[int] = None
    available: Optional[bool] = None

class ProductOut(BaseModel):
    id: int
    barcode: str
    title: str
    description: Optional[str]
    brand: Optional[str]
    model: Optional[str]
    colorway: Optional[str]
    category: Optional[str]
    tags: Optional[str]
    size: Optional[str]
    condition: Optional[str]
    sku: Optional[str]
    cost_eur: float
    price_eur: float
    weight_grams: Optional[int]
    package_required: bool
    image_url: Optional[str]
    quantity: int
    available: bool
    location_id: Optional[int]

class SellRequest(BaseModel):
    barcode: str
    quantity: int = 1

class TransferRequest(BaseModel):
    barcode: str
    to_location_id: int
    quantity: int = 1

class LocationCreate(BaseModel):
    name: str

class LocationOut(BaseModel):
    id: int
    name: str

class LookupOut(BaseModel):
    barcode: str
    title: Optional[str]=None
    brand: Optional[str]=None
    model: Optional[str]=None
    colorway: Optional[str]=None
    category: Optional[str]=None
    image_url: Optional[str]=None
    description: Optional[str]=None
    sku: Optional[str]=None
