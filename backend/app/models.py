from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from .core.database import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sku: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    barcode: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    brand: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    size: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    colorway: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    condition: Mapped[str] = mapped_column(String(64), default="new")
    cost_price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    sale_price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    listed: Mapped[bool] = mapped_column(Boolean, default=False)
    shopify_product_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    shopify_inventory_item_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_sold: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
