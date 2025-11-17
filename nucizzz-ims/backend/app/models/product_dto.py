from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field

Source = Literal["OPEN", "RAPIDAPI"]


class ProductDTO(BaseModel):
    barcode: str = Field(..., description="Barcode originale richiesto")
    name: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    images: Optional[List[str]] = None
    quantity: Optional[str] = None
    packaging: Optional[str] = None
    countryOrigin: Optional[str] = None
    attributes: Optional[Dict[str, Union[str, int, float, bool]]] = None
    source: Source
    raw: Optional[dict] = None


class LookupFound(BaseModel):
    status: Literal["FOUND"] = "FOUND"
    data: ProductDTO
    debug: Optional[Dict[str, Any]] = None


class LookupNotFound(BaseModel):
    status: Literal["NOT_FOUND"] = "NOT_FOUND"
    reason: Optional[str] = None
    debug: Optional[Dict[str, Any]] = None


class LookupError(BaseModel):
    status: Literal["ERROR"] = "ERROR"
    code: str
    message: str
    debug: Optional[Dict[str, Any]] = None
