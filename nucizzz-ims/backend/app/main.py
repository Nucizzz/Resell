import os
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import select, or_
from .database import Base, engine, get_db
from .models import Product, Location
from .schemas import ProductCreate, ProductUpdate, ProductOut, SellRequest, TransferRequest, LocationCreate, LocationOut, LookupOut
from .auth import require_token
from .enrich import enrich_barcode

API_BASE=os.getenv("API_BASE_PATH","/api")
ALLOWED_ORIGINS=os.getenv("ALLOWED_ORIGINS","http://localhost").split(",")
UPLOAD_DIR=os.path.join(os.getcwd(),"uploads")
MAX_UPLOAD_MB=int(os.getenv("MAX_UPLOAD_MB","5"))

app=FastAPI(title="Nucizzz IMS Fashion", openapi_url=f"{API_BASE}/openapi.json", docs_url=f"{API_BASE}/docs")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/health")
def health(): return {"ok":True}

app.mount(f"{API_BASE}/uploads", StaticFiles(directory=UPLOAD_DIR, check_dir=False), name="uploads")


def to_out(p:Product)->ProductOut:
    return ProductOut(
        id=p.id, barcode=p.barcode, title=p.title, description=p.description,
        brand=p.brand, model=p.model, colorway=p.colorway, category=p.category, tags=p.tags, size=p.size, condition=p.condition, sku=p.sku,
        cost_eur=p.cost_cents/100.0, price_eur=p.price_cents/100.0, weight_grams=p.weight_grams,
        package_required=p.package_required, image_url=p.image_url, quantity=p.quantity, available=p.available, location_id=p.location_id
    )

# Enrichment
@app.get(f"{API_BASE}/lookup/{{barcode}}", response_model=LookupOut, dependencies=[Depends(require_token)])
async def lookup(barcode:str):
    data=await enrich_barcode(barcode)
    if not data: return LookupOut(barcode=barcode)
    return LookupOut(barcode=barcode, **data)

# Locations
@app.post(f"{API_BASE}/locations", response_model=LocationOut, dependencies=[Depends(require_token)])
def create_location(body:LocationCreate, db:Session=Depends(get_db)):
    if db.scalar(select(Location).where(Location.name==body.name)): raise HTTPException(409,"Location già esistente")
    loc=Location(name=body.name); db.add(loc); db.commit(); db.refresh(loc); return LocationOut(id=loc.id, name=loc.name)

@app.get(f"{API_BASE}/locations", response_model=list[LocationOut], dependencies=[Depends(require_token)])
def list_locations(db:Session=Depends(get_db)):
    items=db.scalars(select(Location).order_by(Location.name)).all()
    return [LocationOut(id=i.id, name=i.name) for i in items]

# Upload
@app.post(f"{API_BASE}/upload", dependencies=[Depends(require_token)])
def upload(file:UploadFile=File(...)):
    if file.content_type not in ("image/jpeg","image/png"): raise HTTPException(400,"Solo JPEG/PNG")
    data=file.file.read()
    if len(data)>MAX_UPLOAD_MB*1024*1024: raise HTTPException(400,"File troppo grande")
    ext=".jpg" if file.content_type=="image/jpeg" else ".png"
    name=f"p_{os.urandom(6).hex()}{ext}"; open(os.path.join(UPLOAD_DIR,name),"wb").write(data)
    return {"url": f"{API_BASE}/uploads/{name}"}

# Products
@app.post(f"{API_BASE}/products/receive", response_model=ProductOut, dependencies=[Depends(require_token)])
def receive(body:ProductCreate, db:Session=Depends(get_db)):
    if db.scalar(select(Product).where(Product.barcode==body.barcode)): raise HTTPException(409,"Barcode già presente")
    p=Product(
        barcode=body.barcode, title=body.title, description=body.description, brand=body.brand, model=body.model, colorway=body.colorway,
        category=body.category, tags=body.tags, size=body.size, condition=body.condition, sku=body.sku,
        cost_cents=int((body.cost_eur or 0)*100), price_cents=int((body.price_eur or 0)*100),
        weight_grams=body.weight_grams, package_required=body.package_required, image_url=body.image_url,
        quantity=body.quantity or 1, available=True, location_id=body.location_id
    )
    db.add(p); db.commit(); db.refresh(p); return to_out(p)

@app.patch(f"{API_BASE}/products/{{product_id}}", response_model=ProductOut, dependencies=[Depends(require_token)])
def update(product_id:int, body:ProductUpdate, db:Session=Depends(get_db)):
    p=db.get(Product, product_id)
    if not p: raise HTTPException(404,"Prodotto non trovato")
    for k,v in body.model_dump(exclude_unset=True).items():
        if k=="cost_eur" and v is not None: p.cost_cents=int(v*100)
        elif k=="price_eur" and v is not None: p.price_cents=int(v*100)
        else: setattr(p,k,v)
    db.add(p); db.commit(); db.refresh(p); return to_out(p)

@app.post(f"{API_BASE}/products/sell", response_model=ProductOut, dependencies=[Depends(require_token)])
def sell(body:SellRequest, db:Session=Depends(get_db)):
    p=db.scalar(select(Product).where(Product.barcode==body.barcode))
    if not p or not p.available or p.quantity<=0: raise HTTPException(404,"Prodotto non disponibile")
    if p.quantity<(body.quantity or 1): raise HTTPException(400,"Quantità insufficiente")
    p.quantity-=(body.quantity or 1)
    if p.quantity==0: p.available=False
    db.add(p); db.commit(); db.refresh(p); return to_out(p)

@app.post(f"{API_BASE}/products/transfer", response_model=ProductOut, dependencies=[Depends(require_token)])
def transfer(body:TransferRequest, db:Session=Depends(get_db)):
    p=db.scalar(select(Product).where(Product.barcode==body.barcode))
    if not p: raise HTTPException(404,"Prodotto non trovato")
    loc=db.get(Location, body.to_location_id)
    if not loc: raise HTTPException(404,"Location di destinazione non trovata")
    p.location_id=loc.id; db.add(p); db.commit(); db.refresh(p); return to_out(p)

@app.delete(f"{API_BASE}/products/{{product_id}}", dependencies=[Depends(require_token)])
def delete(product_id:int, db:Session=Depends(get_db)):
    p=db.get(Product, product_id)
    if not p: raise HTTPException(404,"Prodotto non trovato")
    db.delete(p); db.commit(); return {"ok":True}

@app.get(f"{API_BASE}/products", response_model=list[ProductOut], dependencies=[Depends(require_token)])
def list_products(q:str|None=None, brand:str|None=None, category:str|None=None, location_id:int|None=None, available:bool|None=None, price_min:float|None=None, price_max:float|None=None, limit:int=50, offset:int=0, db:Session=Depends(get_db)):
    stmt=select(Product)
    if q:
        like=f"%{q}%"; from sqlalchemy import or_ as _or
        stmt=stmt.where(_or(Product.title.ilike(like), Product.barcode.ilike(like), Product.description.ilike(like), Product.tags.ilike(like)))
    if brand: stmt=stmt.where(Product.brand.ilike(f"%{brand}%"))
    if category: stmt=stmt.where(Product.category.ilike(f"%{category}%"))
    if location_id is not None: stmt=stmt.where(Product.location_id==location_id)
    if available is not None: stmt=stmt.where(Product.available==available)
    if price_min is not None: stmt=stmt.where(Product.price_cents>=int(price_min*100))
    if price_max is not None: stmt=stmt.where(Product.price_cents<=int(price_max*100))
    items=db.scalars(stmt.order_by(Product.id.desc()).limit(limit).offset(offset)).all()
    return [to_out(i) for i in items]
