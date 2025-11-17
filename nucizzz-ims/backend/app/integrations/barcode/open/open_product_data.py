from __future__ import annotations

from typing import Any, Dict, Optional, Tuple


async def lookup_open_product_data(
    barcode: str, timeout: float
) -> Tuple[str, Optional[Dict[str, Any]], Optional[str], Dict[str, Any]]:
    """
    Stub pronto a essere collegato con una futura integrazione Open Product Data/Open EAN.
    Per ora torna NOT_FOUND per mantenere la cascata coerente.
    """
    meta: Dict[str, Any] = {
        "provider": "open_product_data",
        "route": "open_product_data_stub",
        "source": "OPEN",
        "http_status": 204,
    }
    return ("NOT_FOUND", None, None, meta)
