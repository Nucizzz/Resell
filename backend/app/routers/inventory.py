from fastapi import APIRouter, Depends, HTTPException, status
from httpx import HTTPStatusError
from sqlalchemy.ext.asyncio import AsyncSession

from .. import crud
from ..core.database import get_session
from ..models import Product
from ..schemas.product import ProductCreate, ProductRead, ProductUpdate
from ..services.shopify_service import mark_product_sold, push_product_to_shopify

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/", response_model=list[ProductRead])
async def list_inventory(
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
) -> list[Product]:
    return await crud.list_products(session, limit=limit, offset=offset)


@router.post("/scan/inbound", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
async def scan_inbound(
    payload: ProductCreate,
    session: AsyncSession = Depends(get_session),
) -> Product:
    try:
        product = await crud.create_product(session, payload)
    except crud.ProductExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    try:
        shopify_data = await push_product_to_shopify(product)
    except (HTTPStatusError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Errore durante la sincronizzazione con Shopify",
        ) from exc
    product = await crud.update_product(
        session,
        product,
        ProductUpdate(
            listed=True,
            shopify_product_id=str(shopify_data["product_id"]),
            shopify_inventory_item_id=str(shopify_data["inventory_item_id"]),
        ),
    )
    return product


@router.post("/scan/outbound/{barcode}", response_model=ProductRead)
async def scan_outbound(barcode: str, session: AsyncSession = Depends(get_session)) -> Product:
    product = await crud.get_product_by_barcode(session, barcode)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    try:
        await mark_product_sold(product)
    except HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Errore nel decrementare l'inventario su Shopify",
        ) from exc

    product = await crud.update_product(session, product, ProductUpdate(is_sold=True))
    return product


@router.get("/{barcode}", response_model=ProductRead)
async def get_product(barcode: str, session: AsyncSession = Depends(get_session)) -> Product:
    product = await crud.get_product_by_barcode(session, barcode)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product
