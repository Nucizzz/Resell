from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
import os, shutil

from .config import settings
from .db import Base, engine, get_db
from .models import Product
from .schemas import ProductCreate, ProductUpdate, ProductOut
from .security import verify_api_key
from .barcode_lookup import lookup_barcode

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Nucizzz IMS API", root_path=settings.api_base_path)

# CORS (restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploaded images
os.makedirs(settings.uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/products", dependencies=[Depends(verify_api_key)])
def list_products(q: str | None = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    stmt = select(Product)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Product.name.ilike(like), Product.sku.ilike(like), Product.brand.ilike(like), Product.category.ilike(like)))
    stmt = stmt.order_by(Product.created_at.desc()).offset(skip).limit(limit)
    items = db.execute(stmt).scalars().all()
    return [ProductOut.model_validate(i) for i in items]

@app.post("/products", dependencies=[Depends(verify_api_key)])
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    exists = db.execute(select(Product).where(Product.sku == payload.sku)).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=409, detail="SKU/Barcode already exists")
    prod = Product(**payload.model_dump())
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return ProductOut.model_validate(prod)

@app.get("/products/{product_id}", dependencies=[Depends(verify_api_key)])
def get_product(product_id: int, db: Session = Depends(get_db)):
    prod = db.get(Product, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Not found")
    return ProductOut.model_validate(prod)

@app.patch("/products/{product_id}", dependencies=[Depends(verify_api_key)])
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    prod = db.get(Product, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(prod, k, v)
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return ProductOut.model_validate(prod)

@app.delete("/products/{product_id}", dependencies=[Depends(verify_api_key)])
def delete_product(product_id: int, db: Session = Depends(get_db)):
    prod = db.get(Product, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(prod)
    db.commit()
    return {"ok": True}

@app.post("/products/{product_id}/sell", dependencies=[Depends(verify_api_key)])
def sell_product(product_id: int, qty: int = 1, db: Session = Depends(get_db)):
    prod = db.get(Product, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Not found")
    if prod.quantity < qty:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    prod.quantity -= qty
    prod.sold_count += qty
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return ProductOut.model_validate(prod)

@app.post("/upload-image", dependencies=[Depends(verify_api_key)])
async def upload_image(file: UploadFile = File(...)):
    filename = file.filename
    safe_name = filename.replace("/", "_").replace("\", "_")
    dest = os.path.join(settings.uploads_dir, safe_name)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    url = f"/uploads/{safe_name}"
    return {"url": url}

@app.get("/lookup/{barcode}", dependencies=[Depends(verify_api_key)])
async def lookup(barcode: str):
    data = await lookup_barcode(barcode)
    return {"barcode": barcode, **data}

# Basic stats
@app.get("/analytics/summary", dependencies=[Depends(verify_api_key)])
def analytics_summary(db: Session = Depends(get_db)):
    total_products = db.query(Product).count()
    total_qty = db.query(Product).with_entities(Product.quantity).all()
    total_qty = sum(q[0] or 0 for q in total_qty)
    sold = db.query(Product).with_entities(Product.sold_count).all()
    sold_total = sum(s[0] or 0 for s in sold)
    revenue = db.query(Product).with_entities(Product.price, Product.sold_count).all()
    total_revenue = sum((p or 0) * (s or 0) for p, s in revenue)
    return {
        "total_products": total_products,
        "total_quantity": total_qty,
        "sold_total": sold_total,
        "estimated_revenue": total_revenue,
    }