# Nucizzz IMS — Fashion Edition

- Barcode scanner con filtri EAN/UPC e checksum (meno falsi positivi).
- Campi moda (brand, model, colorway, size, condition, sku, category, tags).
- Lookup `/api/lookup/{barcode}` (UPCItemDB + Wikidata). Metti `UPCITEMDB_KEY` in `.env` per risultati migliori.
- Docker stack pronto (db, backend, frontend, caddy, adminer).

## Avvio pulito (Windows / localhost)
```powershell
docker compose down -v
docker system prune -af
docker volume prune -f
# .env già incluso; puoi anche copiare .env.example -> .env
docker compose up -d --build
```
Apri: http://localhost (frontend) — http://localhost/api/docs (API) — http://localhost:8080 (Adminer).

## Produzione
- Imposta DNS verso il VPS, sostituisci `caddy/Caddyfile` con `caddy/Caddyfile.prod` e metti `PUBLIC_HOSTNAME` in `.env`.
- `docker compose up -d --build`.
