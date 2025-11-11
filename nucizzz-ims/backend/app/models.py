from sqlalchemy import Integer, String, Boolean, BigInteger
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    barcode: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    size: Mapped[str] = mapped_column(String(64))
    price_cents: Mapped[int] = mapped_column(Integer, default=0)
    available: Mapped[bool] = mapped_column(Boolean, default=True)

    # Shopify linkage
    shopify_product_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    shopify_variant_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    shopify_inventory_item_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
