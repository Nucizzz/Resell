from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from os import getenv
from pathlib import Path

from .database import Base, engine
from .routers import products, locations, stock, uploads, shopify

API_BASE = getenv("API_BASE_PATH", "/api")

app = FastAPI(title="Nucizzz IMS", openapi_url=f"{API_BASE}/openapi.json", docs_url=f"{API_BASE}/docs")

# CORS (consenti il tuo frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # in prod restringi a dominio frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# crea tabelle all'avvio
@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

# mount static uploads
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount(f"{API_BASE}/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# routers
app.include_router(products.router, prefix=API_BASE)
app.include_router(locations.router, prefix=API_BASE)
app.include_router(stock.router, prefix=API_BASE)
app.include_router(uploads.router, prefix=API_BASE)
app.include_router(shopify.router, prefix=API_BASE)

@app.get("/")
def root():
    return {"ok": True, "api": API_BASE}

@app.get(API_BASE)
def api_root():
    return {"ok": True}

@app.post(API_BASE)
def api_noop():
    return {"ok": True}
