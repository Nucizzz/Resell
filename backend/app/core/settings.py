from functools import lru_cache
from typing import Optional

from pydantic import AnyHttpUrl, BaseSettings, Field


class Settings(BaseSettings):
    app_name: str = "Nucizzz Resell Backend"
    database_url: str = Field(..., alias="DATABASE_URL")

    shopify_api_key: str = Field(..., alias="SHOPIFY_API_KEY")
    shopify_api_secret: str = Field(..., alias="SHOPIFY_API_SECRET")
    shopify_access_token: str = Field(..., alias="SHOPIFY_ACCESS_TOKEN")
    shopify_store_domain: str = Field(..., alias="SHOPIFY_STORE_DOMAIN")
    shopify_location_id: str = Field(..., alias="SHOPIFY_LOCATION_ID")
    shopify_api_version: str = "2024-04"

    backend_cors_origins: list[AnyHttpUrl] | str = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"],
        alias="BACKEND_CORS_ORIGINS",
    )
    webhook_shared_secret: Optional[str] = Field(default=None, alias="SHOPIFY_WEBHOOK_SECRET")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        populate_by_name = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
