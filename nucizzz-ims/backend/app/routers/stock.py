from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/stock", tags=["stock"])

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
        delta = m.qty_change if m.type == "in" else -abs(m.qty_change)
        mv = crud.upsert_stock(db, m.product_id, loc, delta, m.type, m.note)
        return mv
    elif m.type == "out":
        if not m.from_location_id:
            raise HTTPException(400, "from_location_id richiesto")
        mv = crud.upsert_stock(db, m.product_id, m.from_location_id, -abs(m.qty_change), "out", m.note)
        return mv
    else:
        raise HTTPException(400, "Tipo non supportato")
