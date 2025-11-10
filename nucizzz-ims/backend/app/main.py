
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .database import Base, engine, SessionLocal, get_db
from .models import Product
from .schemas import ProductCreate, ProductOut, SellRequest, ShopifySetupRequest, ShopifySetupOut
from .shopify import ShopifyClient, ShopifyError
from sqlalchemy import select
from sqlalchemy.orm import Session
import os

DISABLE_SHOPIFY = os.getenv('DISABLE_SHOPIFY', 'false').lower() in ('1','true','yes')

API_BASE = os.getenv("API_BASE_PATH", "/api")

app = FastAPI(title="Nucizzz IMS", openapi_url=f"{API_BASE}/openapi.json", docs_url=f"{API_BASE}/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

@app.get("/health")
def health():
    return {"ok": True}

@app.post(f"{API_BASE}/shopify/setup", response_model=ShopifySetupOut)
def shopify_setup(payload: ShopifySetupRequest, db: Session = Depends(get_db)):
    client = ShopifyClient(shop=payload.shop, access_token=payload.access_token)
    try:
        location_id = client.ensure_location(payload.location_id)
        # Simple store in env-backed table skipped; return the value so frontend can persist .env manually or in a secrets store
        return ShopifySetupOut(location_id=location_id)
    except ShopifyError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post(f"{API_BASE}/products/receive", response_model=ProductOut)
def receive_product(p: ProductCreate, db: Session = Depends(get_db)):
    # create or update local
    existing = db.scalar(select(Product).where(Product.barcode == p.barcode))
    shop = os.getenv("SHOPIFY_SHOP", "")
    token = os.getenv("SHOPIFY_ACCESS_TOKEN", "")
    location_id = os.getenv("SHOPIFY_LOCATION_ID", "")

    client = None
    if not DISABLE_SHOPIFY:
        client = ShopifyClient(shop=shop, access_token=token, default_location_id=location_id)

    if existing:
        # update price/size/title and increment stock to 1 (or set available true)
        existing.title = p.title
        existing.size = p.size
        existing.price_cents = int(p.price_eur * 100)
        existing.available = True
        db.add(existing)
        db.commit()
        db.refresh(existing)

        # ensure exists in Shopify and set qty=1
        if client:
            client.upsert_product(existing)
            client.set_inventory(existing, quantity=1)
        return ProductOut.from_orm(existing)

    new_p = Product(
        barcode=p.barcode,
        title=p.title,
        size=p.size,
        price_cents=int(p.price_eur * 100),
        available=True,
    )
    db.add(new_p)
    db.commit()
    db.refresh(new_p)

    if client:
        client.upsert_product(new_p)
        client.set_inventory(new_p, quantity=1)
    return ProductOut.from_orm(new_p)

@app.post(f"{API_BASE}/products/sell", response_model=ProductOut)
def sell_product(req: SellRequest, db: Session = Depends(get_db)):
    prod = db.scalar(select(Product).where(Product.barcode == req.barcode))
    if not prod or not prod.available:
        raise HTTPException(status_code=404, detail="Prodotto non disponibile o non trovato")
    prod.available = False
    db.add(prod)
    db.commit()
    db.refresh(prod)

    shop = os.getenv("SHOPIFY_SHOP", "")
    token = os.getenv("SHOPIFY_ACCESS_TOKEN", "")
    location_id = os.getenv("SHOPIFY_LOCATION_ID", "")
    if not DISABLE_SHOPIFY:
        client = ShopifyClient(shop=shop, access_token=token, default_location_id=location_id)
        client.set_inventory(prod, quantity=0)

    return ProductOut.from_orm(prod)

@app.get(f"{API_BASE}/products", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db)):
    items = db.scalars(select(Product).order_by(Product.id.desc())).all()
    return [ProductOut.from_orm(i) for i in items]
