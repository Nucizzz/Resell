from __future__ import annotations

import os

# RapidAPI credentials (never expose in frontend)
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "")
RAPIDAPI_HOST = os.getenv("RAPIDAPI_HOST", "")
RAPIDAPI_PATH = os.getenv("RAPIDAPI_PATH", "/lookup")
RAPIDAPI_QUERY_PARAM = os.getenv("RAPIDAPI_QUERY_PARAM", "barcode")

# HTTP/client settings
HTTP_TIMEOUT = float(os.getenv("HTTP_TIMEOUT", "6.0"))
OPEN_TIMEOUT = float(os.getenv("OPEN_TIMEOUT", "2.5"))
CACHE_TTL = int(os.getenv("CACHE_TTL", "900"))  # 15 minuti di default
