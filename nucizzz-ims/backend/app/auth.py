import os
from fastapi import Header, HTTPException
ADMIN_TOKEN=os.getenv("ADMIN_TOKEN","")
async def require_token(x_admin_token: str|None = Header(default=None, alias="X-Admin-Token")):
    if not ADMIN_TOKEN: return
    if not x_admin_token or x_admin_token!=ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Admin-Token")
