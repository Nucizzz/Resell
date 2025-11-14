import React, { useEffect, useState } from "react";
import { api } from "../api";
import Scanner from "../components/Scanner"; // tuo scanner

export default function SellPage() {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [fromLoc, setFromLoc] = useState<number | "">("");
  const [productsWithStock, setProductsWithStock] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/locations/");
        const payload = r.data;
        const rows = Array.isArray(payload) ? payload : [];
        setLocations(rows);
        if (rows[0]) setFromLoc(rows[0].id);
        if (!Array.isArray(payload)) setMsg("Risposta locations non valida");
      } catch {
        setMsg("Errore caricamento locations");
      }
    })();
  }, []);

  async function searchBarcode() {
    if (!barcode) return;
    await onDetected(barcode);
  }

  async function onDetected(code: string) {
    setBarcode(code);
    setProduct(null);
    setProducts([]);
    setProductsWithStock([]);
    try {
      // Prima prova a ottenere tutti i prodotti con questo barcode
      try {
        const resAll = await api.get(
          `/products/barcode/${encodeURIComponent(code)}/all`
        );
        const allProducts = Array.isArray(resAll.data) ? resAll.data : [resAll.data];
        setProducts(allProducts);
        
        // Se ci sono più prodotti, carica lo stock per ognuno
        if (allProducts.length > 1) {
          const productsWithStockData = await Promise.all(
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
          setProductsWithStock(productsWithStockData);
        } else if (allProducts.length === 1) {
          // Se c'è un solo prodotto, usa quello
          setProduct(allProducts[0]);
        }
        setMsg("");
      } catch {
        // Se l'endpoint /all non funziona, prova quello normale
        const res = await api.get(
          `/products/barcode/${encodeURIComponent(code)}`
        );
        setProduct(res.data);
        setProducts([res.data]);
        setMsg("");
      }
    } catch {
      setProduct(null);
      setProducts([]);
      setProductsWithStock([]);
      setMsg(
        "Prodotto non trovato. Puoi aggiungerlo dalla pagina Nuovo prodotto."
      );
    }
  }

  function selectProduct(p: any) {
    setProduct(p);
  }

  async function sellOne() {
    if (!product) return;
    try {
      await api.post("/stock/movement", {
        product_id: product.id,
        type: "sell",
        qty_change: qty,
        from_location_id: fromLoc || null,
        to_location_id: null,
        note: "POS vendita",
      });
      setMsg(`Venduto ${qty}.`);
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "Errore vendita");
    }
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
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <div className="text-xs text-gray-600">Quantità</div>
          <input className="input" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value || 1))} />
        </div>
        <div>
          <div className="text-xs text-gray-600">Sede</div>
          <select className="input" value={fromLoc} onChange={(e) => setFromLoc(Number(e.target.value))}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      {products.length > 1 && !product ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Trovati {products.length} prodotti con questo barcode. Seleziona quale vendere:
          </div>
          {productsWithStock.length > 0 ? (
            productsWithStock.map((p: any) => {
              const locationName = (id: number) => locations.find(l => l.id === id)?.name || `Location ${id}`;
              const totalStock = p.stock.reduce((sum: number, s: any) => sum + s.qty, 0);
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
                        {locationName(s.location_id)}: {s.qty}
                      </span>
                    ))}
                  </div>
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
        <div className="card">
          <div className="font-medium">{product.title}</div>
          <div className="text-sm text-gray-600">
            SKU {product.sku} • {product.brand || "N/A"}
          </div>
          <button className="btn mt-2" onClick={sellOne}>
            Vendi
          </button>
        </div>
      ) : (
        <div className="text-sm">{msg || "Scansiona o cerca un barcode per vendere."}</div>
      )}
    </div>
  );
}
