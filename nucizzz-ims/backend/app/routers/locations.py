from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import schemas, models, crud
from sqlalchemy import select

router = APIRouter(prefix="/locations", tags=["locations"])

@router.get("/", response_model=List[schemas.LocationOut])
def list_locations(db: Session = Depends(get_db)):
    return db.scalars(select(models.Location)).all()

@router.post("/", response_model=schemas.LocationOut)
def create_location(data: schemas.LocationCreate, db: Session = Depends(get_db)):
    loc = crud.get_or_create_location(db, data.name)
    return loc
