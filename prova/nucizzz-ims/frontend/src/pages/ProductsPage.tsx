import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api"; // usa il tuo helper esistente
import { useLocationSelection } from "../contexts/LocationContext";
import ScanInput from "../components/ScanInput";
import BarcodeModal from "../components/BarcodeModal";

type Product = {
  id: number;
  sku: string;
  barcode?: string;
  title: string;
  brand?: string;
  price?: number;
  image_url?: string;
  is_active?: boolean;
  stock?: { location_id: number; qty: number }[];
  total_qty?: number;
};

export default function ProductsPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const [msg, setMsg] = useState("");
  const [brand, setBrand] = useState<string>("");
  const [onlyActive, setOnlyActive] = useState<boolean>(true);
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sortKey, setSortKey] = useState<string>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(9);
  const [onlyHere, setOnlyHere] = useState(false);
  const { mode, location: currentLocation, locations: knownLocations, openSelector } = useLocationSelection();
  const currentLocationId = mode === "location" ? currentLocation?.id ?? null : null;
  const currentLocationName = currentLocation?.name ?? "Location";
  const brands = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.brand && set.add(r.brand));
    return Array.from(set).sort();
  }, [rows]);

  useEffect(() => {
    if (mode !== "location") {
      setOnlyHere(false);
    }
  }, [mode]);

  async function load(search?: string) {
    setLoading(true);
    try {
      const query = typeof search === "string" ? search : q;
      const res = await api.get("/products/with-stock", { params: { q: query, limit: 100 } });
      const payload = res.data;
      if (Array.isArray(payload)) {
        setRows(
          payload.map((item: any) => ({
            ...item,
            stock: Array.isArray(item.stock) ? item.stock : [],
            total_qty: typeof item.total_qty === "number" ? item.total_qty : 0,
          }))
        );
      } else {
        console.error("Unexpected /products/with-stock response shape:", payload);
        setMsg("Errore API prodotti: risposta non valida");
        setRows([]);
      }
    } catch (err) {
      console.error("Error loading products:", err);
      setMsg("Errore caricamento prodotti");
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (scanOpen) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [scanOpen]);

  const skeleton = useMemo(() => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card animate-pulse flex gap-3 items-center">
          <div className="w-[90px] h-[90px] rounded bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-2/3" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  ), []);

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let data = rows;
    if (onlyActive) data = data.filter((r) => r.is_active !== false);
    if (brand) data = data.filter((r) => r.brand === brand);
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;
    if (min !== null) data = data.filter((r) => (r.price ?? 0) >= min);
    if (max !== null) data = data.filter((r) => (r.price ?? 0) <= max);
    if (onlyHere && currentLocationId) {
      data = data.filter((r) =>
        (r.stock || []).some((s) => s.location_id === currentLocationId && s.qty > 0)
      );
    }
    return data;
  }, [rows, brand, onlyActive, minPrice, maxPrice, onlyHere, currentLocationId]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const va = (a as any)[sortKey];
      const vb = (b as any)[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return sortDir === "asc" ? -1 : 1;
      if (vb == null) return sortDir === "asc" ? 1 : -1;
      if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paged = useMemo(() => {
    const start = (page - 1) * perPage;
    return sorted.slice(start, start + perPage);
  }, [sorted, page, perPage]);

  const getLocationName = (id: number) => {
    const loc = knownLocations.find((l) => l.id === id);
    return loc ? loc.name : `Location ${id}`;
  };

  const handleScan = async (code: string) => {
    if (!code) return;
    setScanOpen(false);
    setQ(code);
    await load(code);
  };

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Prodotti</h1>
      {loading && skeleton}
      <div className="flex gap-2 flex-wrap">
        <ScanInput
          ref={barcodeInputRef}
          placeholder="Cerca SKU/Barcode/Titolo"
          value={q}
          onChange={setQ}
          onScan={(code) => handleScan(code)}
          onRequestScan={() => setScanOpen(true)}
        />
        <div>
          <div className="text-xs text-gray-600">Marca</div>
          <select className="input" value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">Tutte</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        {mode === "location" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyHere} onChange={(e) => setOnlyHere(e.target.checked)} />
            Solo {currentLocationName}
          </label>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
          Solo attivi
        </label>
        <input className="input" type="number" placeholder="Prezzo min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
        <input className="input" type="number" placeholder="Prezzo max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        <div>
          <div className="text-xs text-gray-600">Ordina per</div>
          <select className="input" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            <option value="title">Titolo</option>
            <option value="brand">Marca</option>
            <option value="price">Prezzo</option>
            <option value="sku">SKU</option>
          </select>
        </div>
        <div>
          <div className="text-xs text-gray-600">Direzione</div>
          <select className="input" value={sortDir} onChange={(e) => setSortDir(e.target.value as any)}>
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>
        <button className="btn" onClick={() => load()} disabled={loading}>
          {loading ? "..." : "Cerca"}
        </button>
        <a className="btn" href="/products/new">
          Nuovo prodotto
        </a>
      </div>
      {msg && <div className="text-sm text-red-600">{msg}</div>}
      <div className="grid md:grid-cols-3 gap-3">
        {paged.map((p) => (
          <div key={p.id} className="card flex gap-3 items-center">
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
              <div className="text-xs text-gray-500 mt-1">
                {p.stock && p.stock.length ? (
                  <div className="flex flex-wrap gap-1">
                    {p.stock.map((s) => (
                      <span
                        key={`${p.id}-${s.location_id}`}
                        className={`px-2 py-1 rounded-full ${s.location_id === currentLocationId ? "bg-black text-white" : "bg-gray-200"}`}
                      >
                        {getLocationName(s.location_id)}: {s.qty}
                      </span>
                    ))}
                    <span className="px-2 py-1 rounded-full bg-gray-100 font-semibold text-gray-700">
                      Totale: {p.total_qty ?? 0}
                    </span>
                  </div>
                ) : (
                  <span>Nessuno stock registrato</span>
                )}
              </div>
            </div>
            <div className="ml-auto flex gap-2 flex-wrap">
              <a className="btn" href={`/products/edit/${p.id}`}>
                Modifica
              </a>
              <button
                className="btn bg-red-100"
                onClick={async () => {
                  try {
                    await api.patch(`/products/${p.id}`, { is_active: false });
                    setRows((r) => r.filter((x) => x.id !== p.id));
                  } catch (e: any) {
                    setMsg(e?.response?.data?.detail || "Errore eliminazione");
                  }
                }}
              >
                Elimina
              </button>
              <button
                className={`btn ${!currentLocationId ? "opacity-60 cursor-not-allowed" : ""}`}
                onClick={async () => {
                  if (!currentLocationId) {
                    setMsg("Seleziona una location per usare la vendita rapida.");
                    openSelector();
                    return;
                  }
                  try {
                    await api.post("/stock/movement", {
                      product_id: p.id,
                      type: "sell",
                      qty_change: 1,
                      from_location_id: currentLocationId,
                      to_location_id: null,
                      note: "Vendita rapida",
                    });
                    setMsg(`Venduto 1 da ${currentLocation?.name}`);
                  } catch (e: any) {
                    setMsg(e?.response?.data?.detail || "Errore vendita");
                  }
                }}
              >
                {currentLocationId ? `Vendi 1 (${currentLocationName})` : "Scegli una location"}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div className="text-sm">Pagina {page} di {totalPages}</div>
        <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
        <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
        <select className="input w-[100px]" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
          <option value={6}>6</option>
          <option value={9}>9</option>
          <option value={12}>12</option>
        </select>
      </div>

      <BarcodeModal
        open={scanOpen}
        onOpenChange={setScanOpen}
        onDetected={(code) => handleScan(code)}
        focusRef={barcodeInputRef}
      />
    </div>
  );
}
