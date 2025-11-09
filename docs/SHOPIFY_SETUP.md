# Shopify configuration guide

1. **Create a private app**
   - Shopify Admin → Apps → Develop apps → Create app.
   - Enable scopes: `write_products`, `read_products`, `write_inventory`, `read_inventory`.
   - Generate Admin API access token.

2. **Retrieve location ID**
   - Shopify Admin → Settings → Locations.
   - Open the store location used for fulfilment and copy the ID from the URL.

3. **Environment variables**
   - Add the token, API key, secret, domain and location ID to `backend/.env`.

4. **Webhook secret (optional)**
   - Create a webhook for `inventory_levels/update` pointing to `https://api.nucizzz.shop/webhooks/shopify` (endpoint TBD).
   - Copy the HMAC secret to `SHOPIFY_WEBHOOK_SECRET`.

5. **Test**
   - Run the backend locally and use the inbound scan endpoint to publish a product.
   - Verify the product appears in Shopify with correct price and stock.
