from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.models.product_dto import LookupError, LookupFound, LookupNotFound
from app.services.barcode_lookup import lookup_barcode, validate_barcode

router = APIRouter(tags=["barcode"])


@router.get(
    "/barcode/{code}",
    response_model=LookupFound | LookupNotFound | LookupError,
    summary="Ricerca informazioni prodotto in base al barcode",
)
async def get_barcode(code: str, request: Request):
    code = code.strip()
    if not validate_barcode(code):
        raise HTTPException(
            status_code=400,
            detail={"status": "ERROR", "code": "INVALID_BARCODE", "message": "Formato barcode non valido"},
        )

    nocache = request.query_params.get("nocache") == "1"
    debug = request.query_params.get("debug") == "1"

    result = await lookup_barcode(code, nocache=nocache, debug=debug)
    if result["status"] == "ERROR":
        raise HTTPException(status_code=502, detail=result)
    return result
