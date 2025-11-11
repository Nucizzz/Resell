from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Boolean
from sqlalchemy.sql import func
from .db import Base

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    sku = Column(String(128), unique=True, index=True, nullable=False)  # usually barcode
    brand = Column(String(128), index=True, nullable=True)
    category = Column(String(128), index=True, nullable=True)
    size = Column(String(64), nullable=True)
    price = Column(Float, nullable=False, default=0.0)
    cost = Column(Float, nullable=True)
    quantity = Column(Integer, nullable=False, default=0)
    sold_count = Column(Integer, nullable=False, default=0)
    description = Column(Text, nullable=True)
    image_url = Column(String(1024), nullable=True)
    active = Column(Boolean, default=True)
    shopify_product_id = Column(String(64), nullable=True)
    shopify_variant_id = Column(String(64), nullable=True)
    inventory_item_id = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())