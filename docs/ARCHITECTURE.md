# System architecture

The repository hosts a complete inventory management platform tailored for a reselling business.

```
┌─────────────┐       ┌──────────────┐        ┌────────────┐
│ Barcode     │       │ FastAPI      │        │ PostgreSQL │
│ scanners &  │ ───▶  │ backend API  │ ───▶   │ database   │
│ Shopify App │       │              │        │            │
└─────────────┘       └──────────────┘        └────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │ React/Vite   │
                       │ gestionale UI│
                       └──────────────┘
```

* **Backend** exposes `/inventory` endpoints for inbound/outbound scans and communicates with Shopify APIs.
* **Frontend** offers a scanner-friendly dashboard to register new arrivals and mark products as sold.
* **Database** persists product metadata; the backend automatically creates tables on startup.

## Shopify integration
* `app/services/shopify_service.py` holds the async client to create products and adjust inventory.
* Secrets are injected via environment variables. The service expects a private app with read/write access to Products and Inventory.
* When a product is scanned inbound it is published to Shopify and the inventory is adjusted to show one available unit.

## Cloud deployment
* Use the Dockerfiles under `backend/` and `frontend/` to build images.
* `infrastructure/docker-compose.yaml` orchestrates a local stack (PostgreSQL + backend + frontend).
* For production, adapt the compose file into Cloudflare or Kubernetes manifests. Point the `frontend` deployment to `https://nucizzz.shop` and expose the FastAPI backend behind an HTTPS reverse proxy.
