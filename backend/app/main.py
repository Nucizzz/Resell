from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.database import async_engine, Base
from .core.settings import get_settings
from .routers import inventory


@asynccontextmanager
def lifespan(app: FastAPI):
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, lifespan=lifespan)

origins = settings.backend_cors_origins
if isinstance(origins, str):
    origins = [origin.strip() for origin in origins.split(",") if origin]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(inventory.router)


@app.get("/healthz")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
