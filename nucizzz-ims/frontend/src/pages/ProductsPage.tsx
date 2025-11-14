import React, { useEffect, useMemo, useState, useContext } from "react";
import { api } from "../api"; // usa il tuo helper esistente
import Scanner from "../components/Scanner";

type Product = {
  id: number;
  sku: string;
  barcode?: string;
  title: string;
  brand?: string;
  price?: number;
  image_url?: string;
  is_active?: boolean;
};

export default function ProductsPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [brand, setBrand] = useState<string>("");
  const [onlyActive, setOnlyActive] = useState<boolean>(true);
  const [defaultLocationId, setDefaultLocationId] = useState<number | null>(null);
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sortKey, setSortKey] = useState<string>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(9);
  const brands = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.brand && set.add(r.brand));
    return Array.from(set).sort();
  }, [rows]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/products/", { params: { q, limit: 100 } });
      const payload = res.data;
      // Defensive: ensure we set an array to rows. Backend should return an array,
      // but if something else arrives (HTML error page, object wrapper), avoid crash.
      if (Array.isArray(payload)) {
        setRows(payload);
      } else if (payload && Array.isArray((payload as any).items)) {
        setRows((payload as any).items);
      } else {
        console.error("Unexpected /products response shape:", payload);
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
      // scroll to top to ensure modal is fully visible on mobile
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

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/locations/");
        const rows = Array.isArray(r.data) ? r.data : [];
        if (rows[0]) setDefaultLocationId(rows[0].id);
      } catch {}
    })();
  }, []);

  const filtered = useMemo(() => {
    let data = rows;
    if (onlyActive) data = data.filter((r) => r.is_active !== false);
    if (brand) data = data.filter((r) => r.brand === brand);
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;
    if (min !== null) data = data.filter((r) => (r.price ?? 0) >= min);
    if (max !== null) data = data.filter((r) => (r.price ?? 0) <= max);
    return data;
  }, [rows, brand, onlyActive, minPrice, maxPrice]);

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

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Prodotti</h1>
      {loading && skeleton}
      <div className="flex gap-2 flex-wrap">
        <input
          className="input"
          placeholder="Cerca SKU/Barcode/Titolo"
          value={q}
          onChange={(e) => setQ(e.target.value)}
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
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? "..." : "Cerca"}
        </button>
        <button className="btn" onClick={() => setScanOpen(true)}>
          Scansiona barcode
        </button>
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
                className="btn"
                onClick={async () => {
                  try {
                    if (!defaultLocationId) { setMsg("Nessuna sede: crea una Location prima di vendere"); return; }
                    await api.post("/stock/movement", {
                      product_id: p.id,
                      type: "sell",
                      qty_change: 1,
                      from_location_id: defaultLocationId,
                      to_location_id: null,
                      note: "Vendita rapida",
                    });
                    setMsg("Venduto 1");
                  } catch (e: any) {
                    setMsg(e?.response?.data?.detail || "Errore vendita");
                  }
                }}
              >
                Vendi 1
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

      {scanOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-3 space-y-2">
            <div className="flex justify-between items-center">
              <div className="font-medium">Scanner barcode</div>
              <button
                className="btn bg-gray-100"
                onClick={() => setScanOpen(false)}
              >
                Chiudi
              </button>
            </div>
            <Scanner
              onDetected={async (code) => {
                setScanOpen(false);
                setQ(code);
                await load();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
