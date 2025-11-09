# Nucizzz Resell Platform

Gestionale completo per il negozio di reselling di abbigliamento e sneakers. Comprende:

- **Backend FastAPI** per gestire scansioni in entrata/uscita, database PostgreSQL e sincronizzazione automatica (creazione e decremento stock) con Shopify
- **Frontend React/Vite** per un pannello scanner-friendly
- **Docker Compose** per avviare l&apos;intero stack (database, backend, frontend)
- Documentazione su architettura e deploy

## Struttura repository

```
backend/      # API FastAPI + integrazione Shopify
frontend/     # Applicazione React per gestione inventario
infrastructure/ # docker-compose e asset di deploy
docs/         # Approfondimenti architetturali
```

## Requisiti
- Python 3.11+
- Node.js 20+
- PostgreSQL 15+ (o container Docker)
- Account Shopify con app privata

## Setup ambiente locale

1. **Database PostgreSQL**
   ```bash
   docker run --name resell-db -e POSTGRES_USER=nucizzz -e POSTGRES_PASSWORD=change-me \
     -e POSTGRES_DB=resell -p 5432:5432 -d postgres:16
   ```

2. **Backend**
   ```bash
   cd backend
   cp .env.example .env  # crea e compila le variabili
   poetry install
   poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. **Frontend**
   ```bash
   cd frontend
   npm install
   VITE_API_BASE_URL=http://localhost:8000 npm run dev -- --host 0.0.0.0 --port 5173
   ```

Il frontend è raggiungibile su `http://localhost:5173` e comunica con l&apos;API su `http://localhost:8000`.

## Variabili ambiente backend

Creare `backend/.env` con:
```
DATABASE_URL=postgresql+asyncpg://nucizzz:change-me@localhost:5432/resell
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SHOPIFY_ACCESS_TOKEN=...
SHOPIFY_STORE_DOMAIN=yourstore.myshopify.com
SHOPIFY_LOCATION_ID=1234567890
SHOPIFY_WEBHOOK_SECRET=optional
```

## Avvio completo con Docker Compose

```bash
cd infrastructure
docker compose up --build
```

Questo comando esegue PostgreSQL, backend e frontend. Il frontend è servito su `http://localhost:5173`, il backend su `http://localhost:8000`. Il build argument `VITE_API_BASE_URL` punta automaticamente al servizio backend.

## Deploy dominio nucizzz.shop

1. **Cloudflare**
   - Punta un record A/CNAME verso l&apos;hosting che ospita il frontend (ad esempio un container su Cloudflare Pages o Workers).
   - Configura un tunnel o un load balancer che inoltra le richieste API verso l&apos;istanza FastAPI.

2. **Database gestito**
   - Crea un database PostgreSQL gestito (ad esempio Neon, Supabase, RDS).
   - Aggiorna `DATABASE_URL` con host, porta e credenziali sicuri.

3. **Backend**
   - Deploya l&apos;immagine Docker su un servizio come Fly.io, Railway, Render o Cloud Run.
   - Espone `/healthz` per monitoraggio.

4. **Frontend**
   - `npm run build` produce la cartella `dist/` da pubblicare su CDN (Cloudflare Pages).
   - Imposta la variabile `VITE_API_BASE_URL` per puntare all&apos;endpoint pubblico del backend e aggiorna il proxy in `vite.config.ts` o usare variabile d&apos;ambiente.

5. **Shopify**
   - Crea un&apos;app privata, ottieni Access Token e Location ID.
   - Configura webhook da Shopify verso `https://api.nucizzz.shop/webhooks/shopify` (endpoint da implementare in seguito) per mantenere sincronizzazione bidirezionale.

## Database schema

```
products
├── id (PK)
├── sku (unique)
├── barcode (unique)
├── name
├── brand
├── size
├── colorway
├── condition
├── cost_price
├── sale_price
├── listed
├── shopify_product_id
├── shopify_inventory_item_id
├── is_sold
├── timestamps
```

Le tabelle vengono create automaticamente all&apos;avvio del backend.

## Test

```bash
cd backend
poetry run pytest
```

## Roadmap
- Implementare webhook Shopify per aggiornare quantità in tempo reale
- Supportare foto e descrizioni dettagliate dei prodotti
- Generare etichette barcode interne
- Dashboard analytics (margine, rotazione stock)
