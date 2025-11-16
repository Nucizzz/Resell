// frontend/src/pages/SetupPage.tsx
import React, { useState } from "react";
import { api } from "../api";

export default function SetupPage() {
  const [shop, setShop] = useState("");
  const [token, setToken] = useState("");
  const [location, setLocation] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function testSave() {
    setMsg(null);
    setErr(null);
    try {
      const r = await api.post("/shopify/setup", {
        shop,
        access_token: token,
        location_id: location || null,
      });
      setMsg(
        `OK! Location ID: ${
          r.data?.location_id || "(non reso)"
        }. Copialo in .env e riavvia.`
      );
      if (r.data?.location_id && !location) setLocation(r.data.location_id);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Errore setup Shopify");
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Setup Shopify</h2>
      <div className="grid md:grid-cols-2 gap-3">
        <input
          className="input"
          placeholder="shop.myshopify.com"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
        />
        <input
          className="input"
          placeholder="Admin API access token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <input
          className="input"
          placeholder="Location ID (opz.)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>
      <button className="btn bg-black text-white" onClick={testSave}>
        Test & Save
      </button>
      {msg && <p className="text-green-600">{msg}</p>}
      {err && <p className="text-red-600">{err}</p>}
      <p className="text-xs text-gray-500">
        Se non vuoi Shopify ora, tieni `DISABLE_SHOPIFY=true` nel .env del
        backend.
      </p>
    </div>
  );
}
