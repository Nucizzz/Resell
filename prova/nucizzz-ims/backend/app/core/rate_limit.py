from __future__ import annotations

import asyncio
import time
from typing import Dict

from fastapi import HTTPException, Request, status


class TokenBucket:
    def __init__(self, capacity: int, refill_rate: float) -> None:
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens = capacity
        self.last_refill = time.monotonic()

    def consume(self, tokens: int = 1) -> bool:
        now = time.monotonic()
        elapsed = now - self.last_refill
        refill = elapsed * self.refill_rate
        if refill > 0:
            self.tokens = min(self.capacity, self.tokens + refill)
            self.last_refill = now
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False


class RateLimiter:
    def __init__(self, max_per_minute: int) -> None:
        self.buckets: Dict[str, TokenBucket] = {}
        self.lock = asyncio.Lock()
        self.capacity = max_per_minute
        self.refill_rate = max_per_minute / 60.0

    async def allow(self, key: str) -> bool:
        async with self.lock:
            bucket = self.buckets.get(key)
            if bucket is None:
                bucket = TokenBucket(self.capacity, self.refill_rate)
                self.buckets[key] = bucket
            return bucket.consume()


lookup_rate_limiter = RateLimiter(60)


async def rate_limit_dependency(request: Request) -> None:
    client_host = request.client.host if request.client else "anonymous"
    allowed = await lookup_rate_limiter.allow(client_host)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please slow down.",
        )

