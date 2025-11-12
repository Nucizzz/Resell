from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
import os, shutil
from .config import settings
from .db import Base, engine, get_db
from .models import Product, Supplier, PurchaseOrder, StockMovement
from .schemas import ProductCreate, ProductUpdate, ProductOut
from .barcode_lookup import lookup_barcode
Base.metadata.create_all(bind=engine)
app = FastAPI(title="Nucizzz IMS API", root_path=settings.api_base_path)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
os.makedirs(settings.uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")
@app.get("/health") async def health(): return {"status":"ok"}
from sqlalchemy.orm import Session
def _list(db:Session,q:str|None,skip:int,limit:int):
    stmt = select(Product)
    if q: like = f"%{q}%"; stmt = stmt.where(or_(Product.name.ilike(like), Product.sku.ilike(like), Product.brand.ilike(like), Product.category.ilike(like)))
    return db.execute(stmt.order_by(Product.created_at.desc()).offset(skip).limit(limit)).scalars().all()
@app.get("/products")
def list_products(q:str|None=None, skip:int=0, limit:int=100, db:Session=Depends(get_db)):
    return [ProductOut.model_validate(i) for i in _list(db,q,skip,limit)]
@app.post("/products")
def create_product(payload:ProductCreate, db:Session=Depends(get_db)):
    if db.execute(select(Product).where(Product.sku==payload.sku)).scalar_one_or_none(): raise HTTPException(status_code=409, detail="SKU esistente")
    prod = Product(**payload.model_dump()); db.add(prod); db.commit(); db.refresh(prod)
    if prod.quantity: db.add(StockMovement(product_id=prod.id, delta=prod.quantity, reason="receive")); db.commit()
    return ProductOut.model_validate(prod)
@app.patch("/products/{pid}")
def update_product(pid:int, payload:ProductUpdate, db:Session=Depends(get_db)):
    p = db.get(Product,pid); if not p: raise HTTPException(status_code=404, detail="Not found")
    before = p.quantity
    for k,v in payload.model_dump(exclude_unset=True).items(): setattr(p,k,v)
    db.add(p); db.commit(); db.refresh(p)
    if p.quantity!=before: db.add(StockMovement(product_id=p.id, delta=p.quantity-before, reason="correction")); db.commit()
    return ProductOut.model_validate(p)
@app.post("/products/{pid}/sell")
def sell(pid:int, qty:int=1, db:Session=Depends(get_db)):
    p=db.get(Product,pid); if not p: raise HTTPException(status_code=404, detail="Not found")
    if p.quantity<qty: raise HTTPException(status_code=400, detail="Insufficient stock")
    p.quantity-=qty; p.sold_count+=qty; db.add(p); db.commit(); db.refresh(p)
    db.add(StockMovement(product_id=p.id, delta=-qty, reason="sale")); db.commit()
    return ProductOut.model_validate(p)
@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    filename = file.filename.replace('/','_').replace('\\','_'); dest = os.path.join(settings.uploads_dir, filename)
    with open(dest, 'wb') as f: shutil.copyfileobj(file.file, f)
    return {"url": f"/uploads/{filename}"}
@app.get("/lookup/{barcode}")
async def lookup(barcode:str): return {"barcode":barcode, **(await lookup_barcode(barcode))}
@app.get("/analytics/summary")
def analytics_summary(db:Session=Depends(get_db)):
    total_products = db.query(Product).count()
    total_qty = sum(map(lambda t:t[0] or 0, db.query(Product.quantity).all()))
    sold_total = sum(map(lambda t:t[0] or 0, db.query(Product.sold_count).all()))
    total_revenue = sum((p or 0)*(s or 0) for p,s in db.query(Product.price, Product.sold_count).all())
    return {"total_products": total_products, "total_quantity": total_qty, "sold_total": sold_total, "estimated_revenue": total_revenue}
