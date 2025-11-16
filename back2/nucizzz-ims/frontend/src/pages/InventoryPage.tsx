import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useLocationSelection } from "../contexts/LocationContext";

type Product = {
  id: number;
  title: string;
  barcode?: string;
  sku?: string;
  stock?: { location_id: number; qty: number }[];
  total_qty?: number;
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [hideZero, setHideZero] = useState(false);
  const { locations, mode, location: currentLocation, openSelector } = useLocationSelection();
  const focusLocationId = mode === "location" ? currentLocation?.id ?? null : null;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/products/with-stock", { params: { limit: 200 } });
        const list = Array.isArray(res.data) ? res.data : [];
        setProducts(
          list.map((item: any) => ({
            ...item,
            stock: Array.isArray(item.stock) ? item.stock : [],
            total_qty: typeof item.total_qty === "number" ? item.total_qty : 0,
          }))
        );
      } catch {
        setErr("Errore caricamento inventario");
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getLocationName = (locationId: number): string => {
    const loc = locations.find(l => l.id === locationId);
    return loc ? loc.name : `Location ${locationId}`;
  };

  const filteredProducts = useMemo(() => {
    let data = products;
    if (search) {
      const term = search.toLowerCase();
      data = data.filter((p) =>
        p.title.toLowerCase().includes(term) ||
        (p.sku || "").toLowerCase().includes(term) ||
        (p.barcode || "").toLowerCase().includes(term)
      );
    }
    if (hideZero) {
      data = data.filter((p) => (p.total_qty ?? 0) > 0);
    }
    return data;
  }, [products, search, hideZero]);

  const totalPieces = useMemo(
    () => filteredProducts.reduce((sum, p) => sum + (p.total_qty ?? 0), 0),
    [filteredProducts]
  );
  const focusLocationPieces = useMemo(() => {
    if (!focusLocationId) return null;
    return filteredProducts.reduce((sum, p) => {
      const entry = (p.stock || []).find((s) => s.location_id === focusLocationId);
      return sum + (entry?.qty ?? 0);
    }, 0);
  }, [filteredProducts, focusLocationId]);

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Inventario</h1>
      {err && <p className="text-red-600">{err}</p>}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-xs uppercase text-gray-500">SKU monitorati</div>
          <div className="text-2xl font-semibold">{filteredProducts.length}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-xs uppercase text-gray-500">Pezzi totali</div>
          <div className="text-2xl font-semibold">{totalPieces}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-xs uppercase text-gray-500">Sede attiva</div>
          {focusLocationId ? (
            <>
              <div className="text-2xl font-semibold">{currentLocation?.name}</div>
              <div className="text-sm text-gray-500">{focusLocationPieces} pezzi disponibili</div>
            </>
          ) : (
            <div>
              <div className="text-2xl font-semibold">Vista generale</div>
              <div className="text-sm text-gray-500">Seleziona una sede per filtrare</div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <div className="text-xs text-gray-600">Cerca</div>
          <input className="input" placeholder="Cerca per titolo, SKU o barcode" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
          Nascondi prodotti senza stock
        </label>
        <button className="btn" onClick={openSelector}>
          {focusLocationId ? "Cambia sede" : "Scegli sede"}
        </button>
      </div>

      {loading && <div className="text-sm text-gray-500">Caricamento inventario...</div>}

      <div className="space-y-2">
        {filteredProducts.map((p) => {
          const productStocks = p.stock || [];
          const totalQty = p.total_qty ?? productStocks.reduce((sum, s) => sum + s.qty, 0);
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
                        key={`${p.id}-${s.location_id}-${i}`}
                        className={`px-3 py-1 rounded-lg font-medium ${focusLocationId === s.location_id ? "bg-black text-white" : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"}`}
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
