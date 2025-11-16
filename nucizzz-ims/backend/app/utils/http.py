from __future__ import annotations

from typing import Any, Dict, Optional

import httpx


async def try_fetch_json(
    url: str,
    *,
    timeout_ms: int = 5000,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    params: Optional[Dict[str, str]] = None,
) -> Any | None:
    timeout = httpx.Timeout(timeout_ms / 1000)
    try:
        async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
            response = await client.request(method=method, url=url, params=params)
    except httpx.HTTPError:
        return None
    if response.status_code < 200 or response.status_code >= 300:
        return None
    try:
        return response.json()
    except ValueError:
        return None

