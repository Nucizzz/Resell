import React, { useEffect, useState } from "react";
import { api } from "../api";

type Product = { id: number; title: string; barcode?: string; sku?: string };
type Location = { id: number; name: string };

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stocks, setStocks] = useState<Record<number, { location_id: number; qty: number }[]>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Carica locations
        const locRes = await api.get("/locations/");
        const locList = Array.isArray(locRes.data) ? locRes.data : [];
        setLocations(locList);

        // Carica prodotti
        const res = await api.get("/products/", { params: { limit: 100 } });
        const list = Array.isArray(res.data) ? res.data : [];
        setProducts(list);
        
        // Carica stock per ogni prodotto
        const m: Record<number, { location_id: number; qty: number }[]> = {};
        for (const p of list) {
          try {
            const s = await api.get(`/stock/by_product/${p.id}`);
            m[p.id] = Array.isArray(s.data) ? s.data : [];
          } catch {
            m[p.id] = [];
          }
        }
        setStocks(m);
        if (!Array.isArray(res.data)) setErr("Risposta prodotti non valida");
      } catch {
        setErr("Errore caricamento inventario");
      }
    })();
  }, []);

  const getLocationName = (locationId: number): string => {
    const loc = locations.find(l => l.id === locationId);
    return loc ? loc.name : `Location ${locationId}`;
  };

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Inventario</h1>
      {err && <p className="text-red-600">{err}</p>}
      <div className="space-y-2">
        {products.map((p) => {
          const productStocks = stocks[p.id] || [];
          const totalQty = productStocks.reduce((sum, s) => sum + s.qty, 0);
          
          return (
            <div key={p.id} className="card">
              <div className="font-medium">{p.title}</div>
              <div className="text-sm text-gray-600">
                {p.barcode && `Barcode: ${p.barcode} • `}
                SKU: {p.sku || p.id}
              </div>
              <div className="mt-2">
                {productStocks.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {productStocks.map((s, i) => (
                      <div 
                        key={i} 
                        className="px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium"
                      >
                        {getLocationName(s.location_id)}: {s.qty}
                      </div>
                    ))}
                    <div className="px-3 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 font-semibold">
                      Totale: {totalQty}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Nessuno stock disponibile</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
