// frontend/src/pages/SellPage.tsx
import React, { useState } from "react";
import { api } from "../api";
import Scanner from "../components/Scanner";
import ProductCard, { Product } from "../components/ProductCard";

export default function SellPage() {
  const [barcode, setBarcode] = useState("");
  const [found, setFound] = useState<Product | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function search() {
    setMsg(null);
    setErr(null);
    setFound(null);
    try {
      const r = await api.get("/products/by-barcode", { params: { barcode } });
      setFound(r.data || null);
      if (!r.data) setErr("Prodotto non trovato");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Errore ricerca");
    }
  }

  async function sell() {
    if (!barcode) return;
    setMsg(null);
    setErr(null);
    try {
      const r = await api.post("/products/sell", { barcode });
      setMsg(`Venduto: ${r.data?.title ?? barcode}. Stock aggiornato.`);
      setFound(r.data || null);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Errore vendita");
    }
  }

  async function remove() {
    if (!found?.id) return;
    setMsg(null);
    setErr(null);
    try {
      await api.delete(`/products/${found.id}`);
      setMsg(`Eliminato: #${found.id}`);
      setFound(null);
      setBarcode("");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Errore eliminazione");
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Vendita / Uscita</h2>

      <Scanner
        onDetected={(code) => {
          setBarcode(code);
          search();
        }}
        onError={setErr}
      />

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Barcode"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
        />
        <button className="btn bg-gray-100" onClick={search}>
          Cerca
        </button>
      </div>

      {found && <ProductCard p={found} />}

      <div className="flex gap-2">
        <button
          className="btn bg-black text-white"
          onClick={sell}
          disabled={!barcode}
        >
          Segna come VENDUTO
        </button>
        <button
          className="btn bg-red-600 text-white"
          onClick={remove}
          disabled={!found}
        >
          Elimina
        </button>
      </div>

      {msg && <p className="text-green-600">{msg}</p>}
      {err && <p className="text-red-600">{err}</p>}
    </div>
  );
}
