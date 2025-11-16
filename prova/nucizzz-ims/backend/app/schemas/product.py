from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ImageInfo(BaseModel):
    url: str
    width: Optional[int] = None
    height: Optional[int] = None
    credits: Optional[str] = None


class ProductEnrichment(BaseModel):
    found: bool = Field(default=False)
    source: Optional[Literal["OFF", "OBF", "OPF", "RAPID"]] = None
    gtin: str
    title: Optional[str] = None
    brand: Optional[str] = None
    categories: Optional[list[str]] = None
    image: Optional[ImageInfo] = None
    description: Optional[str] = None
    raw: Any = None
