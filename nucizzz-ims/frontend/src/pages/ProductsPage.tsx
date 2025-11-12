import React, { useEffect, useState } from "react";
import { api } from "../api"; // usa il tuo helper esistente

type Product = {
  id: number;
  sku: string;
  barcode?: string;
  title: string;
  brand?: string;
  price?: number;
  image_url?: string;
};

export default function ProductsPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get("/products", { params: { q, limit: 100 } });
    setRows(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Prodotti</h1>
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="Cerca SKU/Barcode/Titolo"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? "..." : "Cerca"}
        </button>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        {rows.map((p) => (
          <div key={p.id} className="card flex gap-3">
            {p.image_url ? (
              <img
                src={p.image_url}
                alt=""
                style={{
                  width: 90,
                  height: 90,
                  objectFit: "cover",
                  borderRadius: 8,
                }}
              />
            ) : (
              <div
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: 8,
                  background: "#e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6b7280",
                  fontSize: 12,
                }}
              >
                No image
              </div>
            )}
            <div>
              <div className="font-medium">{p.title}</div>
              <div className="text-sm text-gray-600">
                {p.brand} • SKU {p.sku} {p.barcode ? `• ${p.barcode}` : ""}
              </div>
              <div className="text-sm">Prezzo: {p.price ?? "-"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
