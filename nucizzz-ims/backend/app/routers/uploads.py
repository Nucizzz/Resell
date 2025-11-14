from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
import uuid

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(tags=["uploads"])

@router.options("/")
async def options_uploads():
    return {"ok": True}


@router.post("/")
async def upload_image(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Solo immagini")
    ext = (file.filename or "").split(".")[-1].lower() or "jpg"
    name = f"{uuid.uuid4().hex}.{ext}"
    dest = UPLOAD_DIR / name
    content = await file.read()
    dest.write_bytes(content)
    return {"filename": name, "url": f"/api/files/{name}"}
