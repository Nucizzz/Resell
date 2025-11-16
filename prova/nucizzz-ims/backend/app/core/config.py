from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    LOOKUP_TIMEOUT_MS: int = 5000
    LOOKUP_TTL_SECONDS: int = 604800
    RAPIDAPI_HOST: str = "barcodes-lookup.p.rapidapi.com"
    RAPIDAPI_KEY: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="allow")


settings = Settings()
