from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, Boolean, Text, ForeignKey, DateTime, func, UniqueConstraint
from .database import Base

class Location(Base):
    __tablename__ = "locations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)

class Product(Base):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("barcode", name="uq_barcode"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    barcode: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # fashion
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)
    model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    colorway: Mapped[str | None] = mapped_column(String(120), nullable=True)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    tags: Mapped[str | None] = mapped_column(String(255), nullable=True)
    size: Mapped[str | None] = mapped_column(String(32), nullable=True)
    condition: Mapped[str | None] = mapped_column(String(32), nullable=True)
    sku: Mapped[str | None] = mapped_column(String(64), nullable=True)

    cost_cents: Mapped[int] = mapped_column(Integer, default=0)
    price_cents: Mapped[int] = mapped_column(Integer, default=0)
    weight_grams: Mapped[int | None] = mapped_column(Integer, nullable=True)
    package_required: Mapped[bool] = mapped_column(Boolean, default=False)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    available: Mapped[bool] = mapped_column(Boolean, default=True)

    location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
