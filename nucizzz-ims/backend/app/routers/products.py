from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from .. import schemas, crud

router = APIRouter(prefix="/products", tags=["products"])

@router.get("/", response_model=List[schemas.ProductOut])
def list_products(q: Optional[str] = None, location_id: Optional[int] = None, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    return crud.list_products(db, q=q, location_id=location_id, limit=limit, offset=offset)

@router.post("/", response_model=schemas.ProductOut)
def create_product(data: schemas.ProductCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_product(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/barcode/{barcode}", response_model=schemas.ProductOut)
def by_barcode(barcode: str, db: Session = Depends(get_db)):
    p = crud.get_product_by_barcode(db, barcode)
    if not p:
        raise HTTPException(404, "Prodotto non trovato")
    return p

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
