from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..shopify import ShopifyClient, ShopifyError

router = APIRouter(tags=["shopify"])

class SetupIn(BaseModel):
    shop: str
    access_token: str
    location_id: str | None = None

@router.post("/setup")
def setup(data: SetupIn):
    try:
        client = ShopifyClient(data.shop, data.access_token, data.location_id)
        loc = client.ensure_location(data.location_id)
        return {"location_id": loc}
    except ShopifyError as e:
        raise HTTPException(400, str(e))