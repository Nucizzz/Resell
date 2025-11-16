from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from .. import schemas, crud, models
from ..crud import get_or_create_location
from ..schemas.product import ProductEnrichment
from ..services.lookup import lookup_product
from ..core.rate_limit import rate_limit_dependency

router = APIRouter(tags=["products"])

@router.options("/receive")
async def options_receive():
    return {"ok": True}

# Static routes first - these will be at /api/products/
@router.get("/", response_model=List[schemas.ProductOut])
def list_products(q: Optional[str] = None, location_id: Optional[int] = None, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    return crud.list_products(db, q=q, location_id=location_id, limit=limit, offset=offset)

@router.get("/lookup", response_model=ProductEnrichment)
async def lookup(
    barcode: str,
    nocache: Optional[int] = Query(None),
    debug: Optional[int] = Query(None),
    _: None = Depends(rate_limit_dependency),
):
    if not barcode or not barcode.isdigit() or not 8 <= len(barcode) <= 14:
        raise HTTPException(status_code=400, detail="Invalid barcode")
    try:
        return await lookup_product(barcode, use_cache=not bool(nocache), debug=bool(debug))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@router.get("/with-stock", response_model=List[schemas.ProductWithStockOut])
def list_products_with_stock(q: Optional[str] = None, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    return crud.list_products_with_stock(db, q=q, limit=limit, offset=offset)

@router.post("/", response_model=schemas.ProductOut)
def create_product(data: schemas.ProductCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_product(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/barcode/{barcode}", response_model=schemas.ProductOut)
def by_barcode(barcode: str, db: Session = Depends(get_db)):
    """Restituisce il primo prodotto trovato con questo barcode (compatibilità retroattiva)"""
    p = crud.get_product_by_barcode(db, barcode)
    if not p:
        raise HTTPException(404, "Prodotto non trovato")
    return p

@router.get("/barcode/{barcode}/all", response_model=List[schemas.ProductOut])
def by_barcode_all(barcode: str, db: Session = Depends(get_db)):
    """Restituisce tutti i prodotti con questo barcode"""
    products = crud.get_products_by_barcode(db, barcode)
    if not products:
        raise HTTPException(404, "Nessun prodotto trovato con questo barcode")
    return products

@router.post("/receive", response_model=schemas.ProductOut)
def receive(data: schemas.ReceiveCreate, db: Session = Depends(get_db)):
    from datetime import datetime
    import time
    from sqlalchemy import select
    from .. import models, crud
    
    loc_id = None
    if data.location:
        loc = get_or_create_location(db, data.location)
        loc_id = loc.id
    
    # Se il barcode esiste già, usa quel prodotto e aggiungi stock alla location
    if data.barcode:
        existing_product = crud.get_product_by_barcode(db, data.barcode)
        if existing_product:
            # Prodotto esistente: aggiungi stock alla location specificata
            if loc_id:
                # Verifica se esiste già stock per questa location
                existing_stock = db.scalar(select(models.Stock).where(
                    (models.Stock.product_id == existing_product.id) &
                    (models.Stock.location_id == loc_id)
                ))
                
                if existing_stock:
                    # Incrementa stock esistente
                    existing_stock.qty += 1
                else:
                    # Crea nuovo stock per questa location
                    new_stock = models.Stock(
                        product_id=existing_product.id,
                        location_id=loc_id,
                        qty=1
                    )
                    db.add(new_stock)
                
                # Crea movimento
                mv = models.StockMovement(
                    product_id=existing_product.id,
                    type="in",
                    qty_change=1,
                    from_location_id=None,
                    to_location_id=loc_id,
                    note="Ricezione merce"
                )
                db.add(mv)
                db.commit()
                db.refresh(existing_product)
            
            return existing_product
    
    # Prodotto non esiste: crealo
    # Genera uno SKU univoco basato sul barcode
    base_sku = data.barcode or f"PROD_{int(time.time())}"
    timestamp_suffix = int(time.time() * 1000) % 1000000
    unique_sku = f"{base_sku}_{timestamp_suffix}"
    
    # Verifica che lo SKU sia unico
    counter = 0
    final_sku = unique_sku
    while db.scalar(select(models.Product).where(models.Product.sku == final_sku)):
        counter += 1
        final_sku = f"{base_sku}_{timestamp_suffix}_{counter}"
    
    payload = schemas.ProductCreate(
        sku=final_sku,
        barcode=data.barcode,
        title=data.title,
        brand=data.brand,
        description=data.description,
        size=data.size,
        color=None,
        weight_grams=data.weight_g,
        package_required=data.package_required,
        cost=data.cost_eur,
        price=data.price_eur,
        image_url=data.image_url,
        is_active=True,
        initial_qty=1 if loc_id else 0,
        location_id=loc_id,
    )
    try:
        return crud.create_product(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Dynamic routes must be last - these will be at /api/products/{pid}
@router.get("/{pid}", response_model=schemas.ProductOut)
def get_one(pid: int, db: Session = Depends(get_db)):
    p = crud.get_product(db, pid)
    if not p:
        raise HTTPException(404, "Prodotto non trovato")
    return p

@router.patch("/{pid}", response_model=schemas.ProductOut)
def update(pid: int, data: dict, db: Session = Depends(get_db)):
    try:
        return crud.update_product(db, pid, data)
    except ValueError as e:
        raise HTTPException(404, detail=str(e))
