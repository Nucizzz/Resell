# Database setup

## Local development

1. Start PostgreSQL via Docker:
   ```bash
   docker run --name resell-db -e POSTGRES_USER=nucizzz -e POSTGRES_PASSWORD=change-me \
     -e POSTGRES_DB=resell -p 5432:5432 -d postgres:16
   ```
2. Update `backend/.env` with the connection string `postgresql+asyncpg://nucizzz:change-me@localhost:5432/resell`.
3. Run `poetry run uvicorn app.main:app --reload` from `backend/`. Tables are created automatically.

## Production on Cloudflare + managed DB

1. Provision a managed PostgreSQL (Neon, Supabase, Railway DB, etc.).
2. Allow inbound connections from your backend hosting provider.
3. Generate a user dedicated to the app with a strong password and `search_path` limited to a dedicated schema (e.g. `resell`).
4. Store the URL as `DATABASE_URL` secret in your deployment platform.
5. Apply migrations if you later add Alembic; currently tables are created automatically on boot.
