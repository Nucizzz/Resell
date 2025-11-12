from pydantic import BaseModel
from typing import Optional
class ProductCreate(BaseModel):
    name: str; sku: str; brand: Optional[str]=None; category: Optional[str]=None; size: Optional[str]=None
    price: float; cost: Optional[float]=None; quantity: int=0; description: Optional[str]=None; image_url: Optional[str]=None
class ProductUpdate(BaseModel):
    name: Optional[str]=None; brand: Optional[str]=None; category: Optional[str]=None; size: Optional[str]=None
    price: Optional[float]=None; cost: Optional[float]=None; quantity: Optional[int]=None; description: Optional[str]=None; image_url: Optional[str]=None; active: Optional[bool]=None
class ProductOut(BaseModel):
    id:int; name:str; sku:str; brand:Optional[str]=None; category:Optional[str]=None; size:Optional[str]=None; price:float; cost:Optional[float]=None; quantity:int; sold_count:int; description:Optional[str]=None; image_url:Optional[str]=None; active:bool
    class Config: from_attributes=True
