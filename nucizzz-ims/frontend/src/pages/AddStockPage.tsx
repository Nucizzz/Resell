import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import Scanner from "../components/Scanner";
import { useLocationSelection } from "../contexts/LocationContext";

type ProductResult = {
  id: number;
  title: string;
  sku: string;
  brand?: string;
  barcode?: string;
  size?: string;
  price?: number;
};

export default function AddStockPage() {
  const { mode, location: currentLocation, openSelector } = useLocationSelection();
  const activeLocationId = mode === "location" ? currentLocation?.id ?? null : null;
  const locationName = currentLocation?.name ?? "";
  const [barcode, setBarcode] = useState("");
  const [products, setProducts] = useState<ProductResult[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductResult | null>(null);
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stockAtLocation, setStockAtLocation] = useState<number | null>(null);
  const navigate = useNavigate();

  async function fetchStock(productId: number) {
    if (!activeLocationId) return;
    try {
      const res = await api.get(`/stock/by_product/${productId}`);
      const all = Array.isArray(res.data) ? res.data : [];
      const currentQty = all.find((s: any) => s.location_id === activeLocationId)?.qty ?? 0;
      setStockAtLocation(currentQty);
    } catch {
      setStockAtLocation(null);
    }
  }

  async function search(code: string) {
    if (!code) return;
    setLoading(true);
    setStatus(null);
    setError(null);
    setSelectedProduct(null);
    setProducts([]);
    setStockAtLocation(null);
    try {
      const res = await api.get(`/products/barcode/${encodeURIComponent(code)}/all`);
      const list = Array.isArray(res.data) ? res.data : [res.data];
      setProducts(list);
      if (list.length === 1) {
        setSelectedProduct(list[0]);
        await fetchStock(list[0].id);
      }
    } catch {
      setError("Barcode non registrato. Registra prima il prodotto.");
    } finally {
      setLoading(false);
    }
  }

  async function onDetected(code: string) {
    setBarcode(code);
    await search(code);
  }

  async function addStock() {
    if (!selectedProduct || !activeLocationId) {
      setError("Seleziona una location operativa e un prodotto.");
      if (!activeLocationId) openSelector();
      return;
    }
    if (qty <= 0) {
      setError("La quantità deve essere almeno 1");
      return;
    }
    setError(null);
    setStatus(null);
    try {
      await api.post("/stock/movement", {
        product_id: selectedProduct.id,
        type: "in",
        qty_change: qty,
        to_location_id: activeLocationId,
        from_location_id: null,
        note: "Aggiunta rapida stock",
      });
      setStatus(`Aggiunte ${qty} unità di ${selectedProduct.title} a ${locationName}`);
      setStockAtLocation((prev) => (typeof prev === "number" ? prev + qty : prev));
      setQty(1);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Errore durante l'aggiunta dello stock");
    }
  }

  function renderProductCard(p: ProductResult) {
    return (
      <button
        key={p.id}
        onClick={async () => {
          setSelectedProduct(p);
          await fetchStock(p.id);
        }}
        className={`w-full text-left rounded-xl border px-4 py-3 transition ${
          selectedProduct?.id === p.id
            ? "border-black bg-black/5 dark:border-white dark:bg-white/10"
            : "border-gray-200 dark:border-gray-700 hover:border-black"
        }`}
      >
        <div className="font-semibold">{p.title}</div>
        <div className="text-xs text-gray-600">
          SKU {p.sku} • {p.brand || "N/A"}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Barcode: {p.barcode || "?"} • Taglia: {p.size || "?"}
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Aggiungi stock rapido</h1>
        <p className="text-sm text-gray-500">
          Scansiona o digita un barcode per aggiungere stock direttamente nella sede selezionata.
        </p>
      </div>

      {activeLocationId ? (
        <div className="rounded-xl border border-dashed border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 p-4 text-sm">
          Operi su <strong>{locationName}</strong>. Ogni movimento verrà registrato qui.
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-amber-400 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm space-y-2">
          <p>Seleziona prima una sede per poter caricare stock.</p>
          <button className="btn" onClick={openSelector}>
            Scegli location
          </button>
        </div>
      )}

      <Scanner onDetected={onDetected} />

      <div className="flex gap-2 flex-wrap items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-gray-600">Barcode manuale</label>
          <input
            className="input"
            placeholder="Inserisci barcode"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
          />
        </div>
        <button className="btn" disabled={!barcode} onClick={() => search(barcode)}>
          Cerca
        </button>
      </div>

      {loading && <div className="text-sm text-gray-500">Ricerca prodotto in corso…</div>}

      {products.length > 0 && (
        <div className="space-y-2">
          {products.length > 1 && (
            <div className="text-sm text-gray-600">
              Trovati {products.length} articoli con questo barcode. Seleziona quello corretto.
            </div>
          )}
          <div className="grid gap-2">
            {products.map((p) => renderProductCard(p))}
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="card space-y-3">
          <div>
            <div className="font-semibold">{selectedProduct.title}</div>
            <div className="text-xs text-gray-500">Barcode: {selectedProduct.barcode || "?"}</div>
          </div>
          {stockAtLocation !== null && (
            <div className="text-sm text-gray-600">
              Stock attuale in {locationName}: {stockAtLocation}
            </div>
          )}
          <div>
            <label className="text-xs text-gray-600">Quantità da aggiungere</label>
            <input
              className="input mt-1"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <button className="btn" onClick={addStock}>
            Aggiungi stock
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/30 p-3 text-sm space-y-2">
          <div>{error}</div>
          {error.includes("non registrato") && barcode && (
            <button className="btn" onClick={() => navigate(`/products/new?barcode=${encodeURIComponent(barcode)}`)}>
              Vai alla pagina Nuovo prodotto
            </button>
          )}
        </div>
      )}

      {status && <div className="text-sm text-green-600">{status}</div>}
    </div>
  );
}

