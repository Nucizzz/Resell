from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Product
from .schemas.product import ProductCreate, ProductUpdate


class ProductExistsError(Exception):
    """Raised when attempting to create a product with an existing barcode or SKU."""


async def create_product(session: AsyncSession, payload: ProductCreate) -> Product:
    product = Product(**payload.model_dump())
    session.add(product)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise ProductExistsError("Product with this SKU or barcode already exists") from exc
    await session.refresh(product)
    return product


async def get_product_by_barcode(session: AsyncSession, barcode: str) -> Product | None:
    result = await session.execute(select(Product).where(Product.barcode == barcode))
    return result.scalar_one_or_none()


async def get_product_by_sku(session: AsyncSession, sku: str) -> Product | None:
    result = await session.execute(select(Product).where(Product.sku == sku))
    return result.scalar_one_or_none()


async def list_products(session: AsyncSession, limit: int = 100, offset: int = 0) -> list[Product]:
    result = await session.execute(select(Product).offset(offset).limit(limit))
    return list(result.scalars().all())


async def update_product(session: AsyncSession, product: Product, payload: ProductUpdate) -> Product:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, key, value)
    await session.commit()
    await session.refresh(product)
    return product


async def delete_product(session: AsyncSession, product: Product) -> None:
    await session.delete(product)
    await session.commit()
