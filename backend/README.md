# Resell Backend

FastAPI backend that provides APIs for scanning and synchronizing inventory with Shopify.

## Features
- Scan inbound and outbound products via barcode or SKU
- Persist inventory data in PostgreSQL
- Automatically push products to Shopify when scanned inbound
- Webhook endpoint to reconcile Shopify inventory updates

## Environment Variables
Create a `.env` file under `backend/` with the following values:

```
DATABASE_URL=postgresql+asyncpg://<user>:<password>@<host>:<port>/<database>
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SHOPIFY_ACCESS_TOKEN=...
SHOPIFY_STORE_DOMAIN=nucizzz.shop
SHOPIFY_LOCATION_ID=<numeric_location_id>
```

`SHOPIFY_STORE_DOMAIN` should be the myshopify domain (e.g. `yourstore.myshopify.com`). The location ID is required for inventory adjustments.

## Running locally

```bash
poetry install
poetry run uvicorn app.main:app --reload
```

## Tests

```bash
poetry run pytest
```
