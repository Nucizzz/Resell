
# Nucizzz IMS — Gestionale Magazzino + Shopify

Stack:
- **Frontend:** React + Vite + TypeScript + Tailwind + `@zxing/browser` per scansione barcode con la fotocamera.
- **Backend:** FastAPI + SQLAlchemy + Pydantic.
- **Database:** PostgreSQL.
- **Proxy/HTTPS:** Caddy (auto Let's Encrypt) — consigliato disattivare il proxy arancione su Cloudflare (DNS only) per l'emissione del certificato automatico.
- **Integrazione:** Shopify Admin API (REST).

## Funzioni chiave
- Ricezione merce: scansioni il barcode ➜ inserisci dettagli ➜ il prodotto viene salvato su Postgres e creato/aggiornato su Shopify.
- Vendita: scansioni il barcode ➜ il prodotto viene segnato come venduto e lo stock su Shopify viene decrementato.
- Sincronizzazione: ogni prodotto salva `shopify_product_id`, `shopify_variant_id`, `inventory_item_id` e usa `location_id` configurata.

## Prerequisiti
- Dominio: `nucizzz.shop` su Cloudflare (impostare record A per l'host desiderato verso il server dove gira Docker).
- Shopify: creare una **Custom App** su Shopify Admin e prendere:
  - `SHOPIFY_SHOP` (es. `mioshop.myshopify.com`)
  - `SHOPIFY_ACCESS_TOKEN` (Admin API access token)
  - `SHOPIFY_LOCATION_ID` (vedi endpoint di setup o pannello Shopify).
- Docker + Docker Compose installati sul server.

## Variabili d'ambiente
Copia `.env.example` in `.env` e sostituisci i valori:
```
cp .env.example .env
```

## Avvio in locale/produzione
```
docker compose up -d --build
```

- Frontend: http(s)://<tuo-dominio> (porta 80/443 su Caddy)
- Backend API: http://backend:8000 (interno) o http(s)://<tuo-dominio>/api
- Swagger API: http(s)://<tuo-dominio>/api/docs

## Flusso rapido
1. Avvia lo stack.
2. Vai su **/setup** nel frontend e inserisci i token Shopify (se non li hai messi nel `.env`) e clicca “Test & Save” per salvare e ottenere/validare la `location_id`.
3. Vai su **Ricezione** per aggiungere prodotti via scansione barcode.
4. Vai su **Vendita** per scalare stock e segnare venduto.

## Note su Shopify
- Scopes richiesti: `write_products`, `write_inventory`, `read_locations`.
- Il sistema crea prodotti con una sola variante legata alla SKU = barcode. Puoi adattare per varianti multiple.

## Deploy con dominio `nucizzz.shop`
1. In Cloudflare aggiungi un record A per `app.nucizzz.shop` verso l'IP del tuo server. Metti **Proxy: OFF** (nuvola grigia) per l'emissione automatica TLS da Caddy.
2. In `.env` imposta `PUBLIC_HOSTNAME=app.nucizzz.shop`.
3. `docker compose up -d --build` e attendi i certificati.
4. Se vuoi tenere il proxy arancione ON, usa certificati origin o disattiva l'Auto HTTPS di Caddy (non consigliato).

---

### Struttura
```
nucizzz-ims/
  backend/
  frontend/
  caddy/
  docker-compose.yml
  .env.example
```

Buon lavoro! ✌️


### Modalità solo gestionale (senza Shopify)
Imposta nel `.env`:
```
DISABLE_SHOPIFY=true
```
Questo evita ogni chiamata verso Shopify e mantiene solo il magazzino locale.


## Avvio su Windows (Locale)
1. Installa Docker Desktop per Windows (con WSL2 attivo).
2. Apri **PowerShell** dentro la cartella del progetto.
3. Copia `.env.example` in `.env` e imposta `DISABLE_SHOPIFY=true` per ora.
4. Avvia: `docker compose up -d --build`
5. Apri **http://localhost** (nota: HTTP, non HTTPS). API su `/api`.

## Produzione con dominio
1. In Cloudflare crea record A `app.nucizzz.shop` → IP del server, **Proxy OFF (DNS only)**.
2. Imposta `PUBLIC_HOSTNAME=app.nucizzz.shop` in `.env`.
3. Sostituisci `caddy/Caddyfile` con `caddy/Caddyfile.prod` (rinomina il file a `Caddyfile`).
4. `docker compose up -d --build` e visita `https://app.nucizzz.shop`.
