// frontend/src/pages/ProductsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import ProductCard, { Product } from "../components/ProductCard";

export default function ProductsPage() {
  const [all, setAll] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [location, setLocation] = useState(""); // sede
  const [size, setSize] = useState("");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let abort = false;
    setLoading(true);
    api
      .get("/products")
      .then((r) => {
        if (!abort) setAll(r.data || []);
      })
      .finally(() => !abort && setLoading(false));
    return () => {
      abort = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return all.filter((p) => {
      if (
        q &&
        !`${p.title || ""} ${p.barcode || ""}`
          .toLowerCase()
          .includes(q.toLowerCase())
      )
        return false;
      if (location && p.location !== location) return false;
      if (size && (p.size || "") !== size) return false;
      const price = p.price_eur ?? 0;
      if (minPrice && price < parseFloat(minPrice)) return false;
      if (maxPrice && price > parseFloat(maxPrice)) return false;
      return true;
    });
  }, [all, q, location, size, minPrice, maxPrice]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Prodotti</h2>

      <div className="grid md:grid-cols-6 gap-2">
        <input
          className="input md:col-span-2"
          placeholder="Cerca titolo o barcode"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="input"
          placeholder="Sede (es. Negozio, Magazzino)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <input
          className="input"
          placeholder="Taglia (es. 42, M)"
          value={size}
          onChange={(e) => setSize(e.target.value)}
        />
        <input
          className="input"
          placeholder="Prezzo min"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
        />
        <input
          className="input"
          placeholder="Prezzo max"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />
      </div>

      {loading && <p>Caricamento…</p>}

      <div className="grid gap-3">
        {filtered.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-gray-500">Nessun prodotto.</p>
        )}
      </div>
    </div>
  );
}
