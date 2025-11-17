from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from os import getenv
from pathlib import Path
from typing import List
import logging

from .api.routes.barcode import router as barcode_router
from .api.routes.health import router as health_router
from .database import Base, engine, SessionLocal
from .routers import products, locations, stock, uploads, shopify
from . import crud

API_BASE = getenv("API_BASE_PATH", "/api")
PUBLIC_HOSTNAME = getenv("PUBLIC_HOSTNAME", "").strip()
FRONTEND_ORIGIN = getenv("FRONTEND_ORIGIN", "").strip()
EXTRA_ALLOWED_ORIGINS = getenv("ADDITIONAL_ALLOWED_ORIGINS", "")
logger = logging.getLogger(__name__)


def _normalize_origin(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    if value.startswith("http://") or value.startswith("https://"):
        return value.rstrip("/")
    return f"https://{value}".rstrip("/")


def _build_allowed_origins() -> List[str]:
    origins: List[str] = []
    primary = _normalize_origin(FRONTEND_ORIGIN or PUBLIC_HOSTNAME)
    if primary:
        origins.append(primary)
    extras = [
        _normalize_origin(item)
        for item in EXTRA_ALLOWED_ORIGINS.split(",")
        if item.strip()
    ]
    origins.extend([origin for origin in extras if origin])
    if not origins:
        origins.append("http://localhost:5173")
    seen = set()
    deduped: List[str] = []
    for origin in origins:
        if origin and origin not in seen:
            deduped.append(origin)
            seen.add(origin)
    return deduped


app = FastAPI(title="Nucizzz IMS", openapi_url=f"{API_BASE}/openapi.json", docs_url=f"{API_BASE}/docs")

# CORS (consenti solo origini esplicite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# crea tabelle all'avvio
@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    # ensure optional columns exist when running without migrations
    with engine.begin() as conn:
        dialect = conn.dialect.name
        try:
            if dialect == "sqlite":
                conn.exec_driver_sql("ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS sale_price FLOAT")
            else:
                conn.exec_driver_sql("ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS sale_price DOUBLE PRECISION")
        except Exception as exc:  # pragma: no cover - best effort
            logger.warning("Unable to ensure sale_price column: %s", exc)
    # Inizializza le location standard se non esistono
    db = SessionLocal()
    try:
        crud.get_or_create_location(db, "warehouse")
        crud.get_or_create_location(db, "negozio treviso")
    finally:
        db.close()

# routers first (higher priority) - mount with explicit prefixes
app.include_router(health_router, prefix=f"{API_BASE}")
app.include_router(barcode_router, prefix=f"{API_BASE}")
app.include_router(products.router, prefix=f"{API_BASE}/products", tags=["products"])
app.include_router(locations.router, prefix=f"{API_BASE}/locations", tags=["locations"])
app.include_router(stock.router, prefix=f"{API_BASE}/stock", tags=["stock"])
app.include_router(uploads.router, prefix=f"{API_BASE}/uploads", tags=["uploads"])
app.include_router(shopify.router, prefix=f"{API_BASE}/shopify", tags=["shopify"])

# mount static uploads (serve files under /api/files/* to avoid conflicts) - must be last
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount(f"{API_BASE}/files", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/")
def root():
    return {"ok": True, "api": API_BASE}
