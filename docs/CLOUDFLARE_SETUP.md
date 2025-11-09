# Cloudflare deployment notes

1. **DNS**
   - Create a CNAME `app.nucizzz.shop` pointing to the frontend hosting provider (Cloudflare Pages or Workers Sites).
   - Create an `api.nucizzz.shop` record pointing to the FastAPI backend (Cloudflare Tunnel or external host).

2. **SSL/TLS**
   - Enable Full (strict) mode in Cloudflare SSL settings.
   - Issue origin certificates if terminating TLS on your infrastructure.

3. **Workers / Tunnels**
   - Optionally run the backend behind a Cloudflare Tunnel to avoid exposing ports publicly.
   - Configure ingress rules so `api.nucizzz.shop` forwards to the backend container.

4. **Caching**
   - Bypass cache for `api.nucizzz.shop/*`.
   - Cache aggressively the static frontend assets served by Pages.

5. **Environment variables**
   - Store Shopify secrets and `DATABASE_URL` in Cloudflare Pages/Workers secrets or the hosting provider used for the backend.
