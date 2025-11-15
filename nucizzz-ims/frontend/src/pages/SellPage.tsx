import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import Scanner from "../components/Scanner";
import { useLocationSelection } from "../contexts/LocationContext";

export default function SellPage() {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [productsWithStock, setProductsWithStock] = useState<any[]>([]);
  const [qty, setQty] = useState<number>(1);
  const [msg, setMsg] = useState("");
  const [salePrice, setSalePrice] = useState<string>("");
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { mode, location: currentLocation, locations, openSelector } = useLocationSelection();
  const activeLocationId = mode === "location" ? currentLocation?.id ?? null : null;
  const locationName = currentLocation?.name ?? "";
  const navigate = useNavigate();

  async function searchBarcode() {
    if (!barcode) return;
    await onDetected(barcode);
  }

  async function onDetected(code: string) {
    setBarcode(code);
    setProduct(null);
    setProducts([]);
    setProductsWithStock([]);
    setSalePrice("");
    setAvailableStock(null);
    setMsg("");
    setSearching(true);
    try {
      try {
        const resAll = await api.get(`/products/barcode/${encodeURIComponent(code)}/all`);
        const allProducts = Array.isArray(resAll.data) ? resAll.data : [resAll.data];
        setProducts(allProducts);
        if (allProducts.length > 1) {
          const withStock = await Promise.all(
            allProducts.map(async (p: any) => {
              try {
                const stockRes = await api.get(`/stock/by_product/${p.id}`);
                const stock = Array.isArray(stockRes.data) ? stockRes.data : [];
                return { ...p, stock };
              } catch {
                return { ...p, stock: [] };
              }
            })
          );
          setProductsWithStock(withStock);
        } else if (allProducts.length === 1) {
          setProduct(allProducts[0]);
          setSalePrice(allProducts[0].price ? String(allProducts[0].price) : "");
          loadStockForProduct(allProducts[0].id);
        }
        setMsg("");
      } catch {
        const res = await api.get(`/products/barcode/${encodeURIComponent(code)}`);
        setProduct(res.data);
        setProducts([res.data]);
        setSalePrice(res.data?.price ? String(res.data.price) : "");
        loadStockForProduct(res.data.id);
        setMsg("");
      }
    } catch {
      setProduct(null);
      setProducts([]);
      setProductsWithStock([]);
      setSalePrice("");
      setAvailableStock(null);
      setMsg("Prodotto non trovato. Puoi aggiungerlo dalla pagina Nuovo prodotto.");
    } finally {
      setSearching(false);
    }
  }

  function selectProduct(p: any) {
    setProduct(p);
    setSalePrice(p.price ? String(p.price) : "");
    loadStockForProduct(p.id);
  }

  async function loadStockForProduct(productId: number) {
    if (!activeLocationId) return;
    setLoadingStock(true);
    try {
      const stockRes = await api.get(`/stock/by_product/${productId}`);
      const stockArr = Array.isArray(stockRes.data) ? stockRes.data : [];
      const currentQty = stockArr.find((s: any) => s.location_id === activeLocationId)?.qty ?? 0;
      setAvailableStock(currentQty);
    } catch {
      setAvailableStock(null);
    } finally {
      setLoadingStock(false);
    }
  }

  async function sellOne() {
    if (!product || !activeLocationId) {
      setMsg("Seleziona una location operativa per registrare la vendita.");
      if (!activeLocationId) openSelector();
      return;
    }
    if (!salePrice || Number(salePrice) <= 0) {
      setMsg("Inserisci un prezzo di vendita valido.");
      return;
    }
    if ((availableStock ?? 0) < qty) {
      setMsg("Stock insufficiente in questa sede.");
      return;
    }
    try {
      setSubmitting(true);
      await api.post("/stock/movement", {
        product_id: product.id,
        type: "sell",
        qty_change: qty,
        from_location_id: activeLocationId,
        to_location_id: null,
        note: "POS vendita",
        sale_price: Number(salePrice),
      });
      setMsg(`Venduto ${qty} pz in ${locationName} a €${Number(salePrice).toFixed(2)}`);
      setAvailableStock((prev) => (typeof prev === "number" ? prev - qty : prev));
      setQty(1);
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "Errore vendita");
    } finally {
      setSubmitting(false);
    }
  }

  if (!activeLocationId) {
    return (
      <div className="p-4 space-y-3">
        <h1 className="text-xl font-semibold">Vendi</h1>
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4 text-sm">
          Seleziona una location per abilitare le vendite. La giacenza verrà scalata dalla sede scelta.
        </div>
        <button className="btn" onClick={openSelector}>Scegli location</button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Vendi</h1>
      <Scanner onDetected={onDetected} />
      <div className="flex gap-2 items-end">
        <div>
          <div className="text-xs text-gray-600">Barcode manuale</div>
          <input className="input" placeholder="Inserisci barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        </div>
        <button className="btn" onClick={searchBarcode}>Cerca</button>
      </div>
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <div className="text-xs text-gray-600">Quantità</div>
          <input className="input" type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
        </div>
        <div className="text-sm text-gray-600">
          Location corrente:
          <div className="font-semibold text-base">{locationName}</div>
        </div>
      </div>

      {searching && <div className="text-sm text-gray-500">Ricerca prodotto in corso…</div>}

      {products.length > 1 && !product ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">Trovati {products.length} prodotti con questo barcode. Seleziona quale vendere:</div>
          {productsWithStock.length > 0
            ? productsWithStock.map((p: any) => {
                const locationNameResolver = (id: number) => locations.find((l) => l.id === id)?.name || `Location ${id}`;
                const totalStock = p.stock.reduce((sum: number, s: any) => sum + s.qty, 0);
                return (
                  <div key={p.id} className="card cursor-pointer hover:bg-gray-50" onClick={() => selectProduct(p)}>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-sm text-gray-600">SKU {p.sku} • {p.brand || "N/A"}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Stock totale: {totalStock} •
                      {p.stock.map((s: any) => (
                        <span key={s.location_id} className="ml-2">
                          {locationNameResolver(s.location_id)}: {s.qty}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            : products.map((p: any) => (
                <div key={p.id} className="card cursor-pointer hover:bg-gray-50" onClick={() => selectProduct(p)}>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-sm text-gray-600">SKU {p.sku} • {p.brand || "N/A"}</div>
                </div>
              ))}
        </div>
      ) : product ? (
        <div className="card space-y-3">
          <div>
            <div className="font-medium">{product.title}</div>
            <div className="text-sm text-gray-600">SKU {product.sku} • {product.brand || "N/A"}</div>
            <div className="text-xs text-gray-500 mt-1">Barcode: {product.barcode || "N/A"} • Taglia: {product.size || "?"}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Prezzo di vendita</div>
            <input
              className="input"
              type="number"
              min={0}
              step={0.01}
              value={salePrice}
              placeholder={product.price ? String(product.price) : "Inserisci prezzo"}
              onChange={(e) => setSalePrice(e.target.value)}
            />
            {availableStock !== null && (
              <div className="text-xs text-gray-600">Stock disponibile a {locationName}: {availableStock}</div>
            )}
            {loadingStock && <div className="text-xs text-gray-500">Calcolo stock…</div>}
          </div>
          <button className="btn" onClick={sellOne} disabled={submitting || !salePrice || Number(salePrice) <= 0}>
            {submitting ? "Registrazione..." : "Vendi"}
          </button>
          {msg && (
            <div className="text-xs text-gray-700">{msg}</div>
          )}
        </div>
      ) : (
        <div className="text-sm">{msg || "Scansiona o cerca un barcode per vendere."}</div>
      )}

      {msg && (!product || !products.length) && (
        <div className="space-y-2">
          <div className="text-sm text-gray-700">{msg}</div>
          {msg.includes("non trovato") && barcode && (
            <button className="btn" onClick={() => navigate(`/products/new?barcode=${encodeURIComponent(barcode)}`)}>
              Vai alla pagina Nuovo prodotto
            </button>
          )}
        </div>
      )}
    </div>
  );
}
