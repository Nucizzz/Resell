from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import crud, schemas
from typing import List, Optional
from sqlalchemy import select, func
from .. import models
from ..sales_log import log_sale

router = APIRouter(tags=["stock"])

@router.get("/low", response_model=List[schemas.ProductOut])
def low_stock(limit: int = 10, db: Session = Depends(get_db)):
    """Get products with low stock (less than 5 items total across all locations)"""
    # Get products with total stock < 5
    subquery = select(
        models.Stock.product_id,
        func.sum(models.Stock.qty).label("total_qty")
    ).group_by(models.Stock.product_id).subquery()
    
    stmt = select(models.Product).join(
        subquery, models.Product.id == subquery.c.product_id
    ).where(subquery.c.total_qty < 5).limit(limit)
    
    return db.execute(stmt).scalars().all()

@router.post("/movement", response_model=schemas.MovementOut)
def movement(m: schemas.MovementCreate, db: Session = Depends(get_db)):
    if m.type == "transfer":
        if not (m.from_location_id and m.to_location_id and m.qty_change > 0):
            raise HTTPException(400, "Transfer non valido")
        mv = crud.transfer_stock(db, m.product_id, m.from_location_id, m.to_location_id, m.qty_change)
        return mv
    elif m.type in ("in", "sell"):
        loc = m.to_location_id if m.type == "in" else m.from_location_id
        if not loc:
            raise HTTPException(400, "Location mancante")
        if m.qty_change <= 0:
            raise HTTPException(400, "La quantità deve essere positiva")
        location_obj = db.get(models.Location, loc)
        if not location_obj:
            raise HTTPException(400, "Location inesistente")
        delta = m.qty_change if m.type == "in" else -abs(m.qty_change)
        try:
            mv = crud.upsert_stock(db, m.product_id, loc, delta, m.type, m.note)
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        if m.type == "sell":
            if m.sale_price is not None and m.sale_price < 0:
                raise HTTPException(400, "Prezzo di vendita non valido")
            product = db.get(models.Product, m.product_id)
            if not product:
                raise HTTPException(404, "Prodotto non trovato")
            sale_price = m.sale_price if m.sale_price is not None else product.price
            try:
                log_sale(
                    product_id=product.id,
                    barcode=product.barcode,
                    title=product.title,
                    size=product.size,
                    sale_price=sale_price,
                    quantity=m.qty_change,
                    location_name=location_obj.name,
                )
            except Exception as exc:  # pragma: no cover
                raise HTTPException(500, f"Errore salvataggio registro vendite: {exc}")
        return mv
    elif m.type == "out":
        if not m.from_location_id:
            raise HTTPException(400, "from_location_id richiesto")
        mv = crud.upsert_stock(db, m.product_id, m.from_location_id, -abs(m.qty_change), "out", m.note)
        return mv
    else:
        raise HTTPException(400, "Tipo non supportato")

@router.get("/movements", response_model=List[schemas.MovementOut])
def list_movements(type: Optional[str] = None, limit: int = 100, offset: int = 0, from_dt: Optional[str] = None, to_dt: Optional[str] = None, db: Session = Depends(get_db)):
    from datetime import datetime
    f = datetime.fromisoformat(from_dt) if from_dt else None
    t = datetime.fromisoformat(to_dt) if to_dt else None
    return crud.list_movements(db, type=type, limit=limit, offset=offset, from_dt=f, to_dt=t)

# Alias for frontend compatibility - some components call /stock/movements
@router.get("/stock/movements", response_model=List[schemas.MovementOut])
def list_movements_stock(type: Optional[str] = None, limit: int = 100, offset: int = 0, from_dt: Optional[str] = None, to_dt: Optional[str] = None, db: Session = Depends(get_db)):
    from datetime import datetime
    f = datetime.fromisoformat(from_dt) if from_dt else None
    t = datetime.fromisoformat(to_dt) if to_dt else None
    return crud.list_movements(db, type=type, limit=limit, offset=offset, from_dt=f, to_dt=t)

@router.get("/by_product/{pid}", response_model=List[schemas.StockOut])
def by_product(pid: int, db: Session = Depends(get_db)):
    stocks = crud.list_stock_by_product(db, pid)
    return [{"location_id": s.location_id, "qty": s.qty} for s in stocks]
