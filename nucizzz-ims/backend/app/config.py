from pydantic import BaseModel
import os
class Settings(BaseModel):
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./ims.db")
    api_base_path: str = os.getenv("API_BASE_PATH", "/api")
    barcodelookup_api_key: str | None = os.getenv("BARCODELOOKUP_API_KEY")
    uploads_dir: str = os.getenv("UPLOADS_DIR", "/app/app/uploads")
settings = Settings()
