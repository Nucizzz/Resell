import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import Scanner from "../components/Scanner"; // tuo scanner
import { useLocationSelection } from "../contexts/LocationContext";

export default function SellPage() {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [productsWithStock, setProductsWithStock] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [availableQty, setAvailableQty] = useState<number | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const { mode, location: currentLocation, locations, openSelector } = useLocationSelection();
  const activeLocationId = mode === "location" ? currentLocation?.id ?? null : null;
  const locationName = currentLocation?.name ?? "";

  const loadStockForProduct = useCallback(async (productId: number) => {
    if (!activeLocationId) {
      setAvailableQty(null);
      return;
    }
    setLoadingStock(true);
    try {
      const res = await api.get(`/stock/by_product/${productId}`);
      const stock = Array.isArray(res.data) ? res.data : [];
      const entry = stock.find((s: any) => s.location_id === activeLocationId);
      setAvailableQty(entry?.qty ?? 0);
    } catch {
      setAvailableQty(null);
    }
    setLoadingStock(false);
  }, [activeLocationId]);

  async function searchBarcode() {
    if (!barcode) return;
    await onDetected(barcode);
  }

  async function onDetected(code: string) {
    setBarcode(code);
    setProduct(null);
    setProducts([]);
    setProductsWithStock([]);
    setAvailableQty(null);
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
          await loadStockForProduct(allProducts[0].id);
        }
        setMsg("");
      } catch {
        const res = await api.get(`/products/barcode/${encodeURIComponent(code)}`);
        setProduct(res.data);
        setProducts([res.data]);
        if (res.data?.id) {
          await loadStockForProduct(res.data.id);
        }
        setMsg("");
      }
    } catch {
      setProduct(null);
      setProducts([]);
      setProductsWithStock([]);
      setAvailableQty(null);
      setMsg("Prodotto non trovato. Puoi aggiungerlo dalla pagina Nuovo prodotto.");
    }
  }

  function selectProduct(p: any) {
    setProduct(p);
    if (Array.isArray(p.stock) && activeLocationId) {
      const entry = p.stock.find((s: any) => s.location_id === activeLocationId);
      setAvailableQty(entry?.qty ?? 0);
    }
  }

  async function sellOne() {
    if (!product || !activeLocationId) {
      setMsg("Seleziona una location operativa per registrare la vendita.");
      if (!activeLocationId) openSelector();
      return;
    }
    if (availableQty === null) {
      setMsg("Caricamento stock in corso, riprova tra poco.");
      return;
    }
    if (qty > availableQty) {
      setMsg(`Stock insufficiente. Disponibili ${availableQty} pezzi in ${locationName}.`);
      return;
    }
    const defaultPrice = product.price ?? product.cost ?? "";
    const priceInput = window.prompt("Prezzo di vendita (per pezzo)", defaultPrice ? String(defaultPrice) : "");
    if (priceInput === null) return;
    const salePrice = parseFloat(priceInput.replace(",", "."));
    if (Number.isNaN(salePrice) || salePrice < 0) {
      setMsg("Inserisci un prezzo valido.");
      return;
    }
    setIsSelling(true);
    try {
      await api.post("/stock/movement", {
        product_id: product.id,
        type: "sell",
        qty_change: qty,
        from_location_id: activeLocationId,
        to_location_id: null,
        note: "POS vendita",
        sale_price: salePrice,
      });
      setMsg(`Venduto ${qty} pezzo/i in ${locationName} a €${salePrice.toFixed(2)}.`);
      setAvailableQty((prev) => (prev === null ? prev : Math.max(0, prev - qty)));
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "Errore vendita");
    }
    setIsSelling(false);
  }

  useEffect(() => {
    if (product && activeLocationId) {
      if (Array.isArray(product.stock) && product.stock.length) {
        const entry = product.stock.find((s: any) => s.location_id === activeLocationId);
        setAvailableQty(entry?.qty ?? 0);
      } else {
        loadStockForProduct(product.id);
      }
    } else if (!activeLocationId) {
      setAvailableQty(null);
    }
  }, [product, activeLocationId, loadStockForProduct]);

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
          <input
            className="input"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => {
              const next = Math.max(1, Number(e.target.value || 1));
              if (availableQty !== null) {
                setQty(Math.min(next, Math.max(1, availableQty)));
              } else {
                setQty(next);
              }
            }}
          />
          {availableQty !== null && (
            <div className="text-xs text-gray-500 mt-1">
              Disponibili in sede: {loadingStock ? "…" : availableQty}
            </div>
          )}
        </div>
        <div className="text-sm text-gray-600">
          Location corrente:
          <div className="font-semibold text-base">{locationName}</div>
        </div>
      </div>

      {products.length > 1 && !product ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Trovati {products.length} prodotti con questo barcode. Seleziona quale vendere:
          </div>
          {productsWithStock.length > 0 ? (
            productsWithStock.map((p: any) => {
              const locationLabel = (id: number) => locations.find((l) => l.id === id)?.name || `Location ${id}`;
              const totalStock = p.stock.reduce((sum: number, s: any) => sum + s.qty, 0);
              const currentLocStock = activeLocationId ? p.stock.find((s: any) => s.location_id === activeLocationId)?.qty ?? 0 : null;
              return (
                <div key={p.id} className="card cursor-pointer hover:bg-gray-50" onClick={() => selectProduct(p)}>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-sm text-gray-600">
                    SKU {p.sku} • {p.brand || "N/A"}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Stock totale: {totalStock} •
                    {p.stock.map((s: any) => (
                      <span key={s.location_id} className="ml-2">
                        {locationLabel(s.location_id)}: {s.qty}
                      </span>
                    ))}
                  </div>
                  {currentLocStock !== null && (
                    <div className="text-xs text-emerald-600 mt-1">
                      Disponibili qui: {currentLocStock}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            products.map((p: any) => (
              <div key={p.id} className="card cursor-pointer hover:bg-gray-50" onClick={() => selectProduct(p)}>
                <div className="font-medium">{p.title}</div>
                <div className="text-sm text-gray-600">
                  SKU {p.sku} • {p.brand || "N/A"}
                </div>
              </div>
            ))
          )}
        </div>
      ) : product ? (
        <div className="card space-y-2">
          <div className="font-medium">{product.title}</div>
          <div className="text-sm text-gray-600">SKU {product.sku} • {product.brand || "N/A"}</div>
          <div className="text-xs text-gray-500">
            Taglia: {product.size || "-"} • Prezzo listino: {product.price ? `€${Number(product.price).toFixed(2)}` : "N/D"}
          </div>
          <div className="text-sm">
            Stock in {locationName || "sede"}: {availableQty ?? "?"}
          </div>
          <button className="btn" onClick={sellOne} disabled={isSelling}>
            {isSelling ? "Registrazione..." : "Vendi"}
          </button>
          {msg && <div className="text-xs text-gray-600">{msg}</div>}
        </div>
      ) : (
        <div className="text-sm">{msg || "Scansiona o cerca un barcode per vendere."}</div>
      )}
    </div>
  );
}
