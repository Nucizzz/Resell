import React, { useState } from "react";
import { api } from "../api";
import Scanner from "../components/Scanner"; // tuo scanner

export default function SellPage() {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [msg, setMsg] = useState("");

  async function onDetected(code: string) {
    setBarcode(code);
    try {
      const res = await api.get(
        `/products/barcode/${encodeURIComponent(code)}`
      );
      setProduct(res.data);
      setMsg("");
    } catch {
      setProduct(null);
      setMsg(
        "Prodotto non trovato. Puoi aggiungerlo dalla pagina Nuovo prodotto."
      );
    }
  }

  async function sellOne() {
    if (!product) return;
    try {
      // supponiamo vendita da LOCATION id=1 (es. Negozio). Puoi renderlo selezionabile.
      await api.post("/stock/movement", {
        product_id: product.id,
        type: "sell",
        qty_change: 1,
        from_location_id: 1,
        to_location_id: null,
        note: "POS vendita",
      });
      setMsg("Venduto 1.");
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "Errore vendita");
    }
  }

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Vendi</h1>
      <Scanner onDetected={onDetected} />
      <div className="text-sm text-gray-600">Barcode: {barcode || "-"}</div>

      {product ? (
        <div className="card">
          <div className="font-medium">{product.title}</div>
          <div className="text-sm text-gray-600">
            SKU {product.sku} • {product.brand}
          </div>
          <button className="btn mt-2" onClick={sellOne}>
            Vendi 1
          </button>
        </div>
      ) : (
        <div className="text-sm">{msg}</div>
      )}
    </div>
  );
}
