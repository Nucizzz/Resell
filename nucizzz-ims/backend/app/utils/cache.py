from __future__ import annotations

import asyncio
import json
import os
import time
from collections import OrderedDict
from typing import Any, Optional

try:
    import redis.asyncio as redis  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    redis = None

DEFAULT_TTL = int(os.getenv("LOOKUP_TTL_SECONDS", "604800"))
MAX_KEYS = 1000
REDIS_URL = os.getenv("REDIS_URL")


class InMemoryLRUCache:
    def __init__(self, max_entries: int = MAX_KEYS, ttl: int = DEFAULT_TTL) -> None:
        self.max_entries = max_entries
        self.ttl = ttl
        self._data: "OrderedDict[str, tuple[Any, float]]" = OrderedDict()
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Any:
        async with self._lock:
            payload = self._data.get(key)
            if not payload:
                return None
            value, expires = payload
            if expires < time.time():
                self._data.pop(key, None)
                return None
            self._data.move_to_end(key)
            return value

    async def set(self, key: str, value: Any) -> None:
        async with self._lock:
            if key in self._data:
                self._data.move_to_end(key)
            self._data[key] = (value, time.time() + self.ttl)
            while len(self._data) > self.max_entries:
                self._data.popitem(last=False)


memory_cache = InMemoryLRUCache()
redis_client = None

if REDIS_URL and redis is not None:
    try:
        redis_client = redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
    except Exception:
        redis_client = None


async def cache_get(key: str) -> Any:
    if redis_client is not None:
        try:
            raw = await redis_client.get(key)
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    return await memory_cache.get(key)


async def cache_set(key: str, value: Any, ttl: Optional[int] = None) -> None:
    ttl_seconds = ttl or DEFAULT_TTL
    if redis_client is not None:
        try:
            await redis_client.set(key, json.dumps(value), ex=ttl_seconds)
        except Exception:
            pass
    await memory_cache.set(key, value)

