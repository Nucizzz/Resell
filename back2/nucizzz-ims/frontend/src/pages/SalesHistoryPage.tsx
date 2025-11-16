import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";

type Movement = {
  id: number;
  product_id: number;
  type: string;
  qty_change: number;
  note?: string;
  created_at: string;
  sale_price?: number | null;
  product?: {
    id: number;
    title: string;
    size?: string | null;
  };
};

const currency = (value?: number | null) =>
  value === undefined || value === null ? "N/D" : `€${value.toFixed(2)}`;

export default function SalesHistoryPage() {
  const [rows, setRows] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [sortKey, setSortKey] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(15);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/stock/movements", {
        params: { type: "sell", limit: 500, from_dt: from || undefined, to_dt: to || undefined },
      });
      setRows(Array.isArray(res.data) ? res.data : []);
      setErr(null);
    } catch {
      setErr("Errore caricamento storico vendite");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [from, to]);

  const filtered = useMemo(() => {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) => {
      const title = r.product?.title?.toLowerCase() || "";
      const note = r.note?.toLowerCase() || "";
      return (
        String(r.product_id).includes(s) ||
        title.includes(s) ||
        note.includes(s) ||
        (r.product?.size || "").toLowerCase().includes(s)
      );
    });
  }, [rows, q]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortKey === "created_at") {
        const da = new Date(a.created_at).getTime();
        const db = new Date(b.created_at).getTime();
        return sortDir === "asc" ? da - db : db - da;
      }
      if (sortKey === "qty_change") {
        return sortDir === "asc" ? Math.abs(a.qty_change) - Math.abs(b.qty_change) : Math.abs(b.qty_change) - Math.abs(a.qty_change);
      }
      if (sortKey === "sale_price") {
        const va = a.sale_price ?? 0;
        const vb = b.sale_price ?? 0;
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const va = (a as any)[sortKey];
      const vb = (b as any)[sortKey];
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paged = useMemo(() => {
    const start = (page - 1) * perPage;
    return sorted.slice(start, start + perPage);
  }, [sorted, page, perPage]);

  const summary = useMemo(() => {
    const totalItems = filtered.reduce((sum, r) => sum + Math.abs(r.qty_change), 0);
    const totalRevenue = filtered.reduce((sum, r) => sum + (r.sale_price ?? 0) * Math.abs(r.qty_change), 0);
    return { totalItems, totalRevenue };
  }, [filtered]);

  function exportExcel() {
    const header = "<tr><th>Nome prodotto</th><th>Taglia</th><th>Prezzo (€)</th></tr>";
    const body = filtered
      .map((r) => {
        const name = r.product?.title || `ID ${r.product_id}`;
        const size = r.product?.size || "";
        const price = r.sale_price ?? 0;
        const esc = (value: string) =>
          value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        return `<tr><td>${esc(name)}</td><td>${esc(size)}</td><td>${price ? price.toFixed(2) : ""}</td></tr>`;
      })
      .join("");
    const table = `<table>${header}${body}</table>`;
    const blob = new Blob([table], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendite_${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Storico vendite</h1>
      {err && <div className="text-red-600">{err}</div>}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-emerald-50 p-3 text-emerald-900">
          <div className="text-xs uppercase tracking-wide">Articoli venduti</div>
          <div className="text-2xl font-bold">{summary.totalItems}</div>
        </div>
        <div className="rounded-xl bg-indigo-50 p-3 text-indigo-900">
          <div className="text-xs uppercase tracking-wide">Incassato</div>
          <div className="text-2xl font-bold">{currency(summary.totalRevenue)}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <div className="text-xs text-gray-600">Da</div>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-gray-600">A</div>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex-1 min-w-[180px]">
          <div className="text-xs text-gray-600">Cerca</div>
          <input className="input" placeholder="Prodotto, taglia o nota" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn" onClick={exportExcel}>Esporta Excel</button>
        <div>
          <div className="text-xs text-gray-600">Ordina per</div>
          <select className="input" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            <option value="created_at">Data</option>
            <option value="product_id">Prodotto</option>
            <option value="qty_change">Quantità</option>
            <option value="sale_price">Prezzo</option>
          </select>
        </div>
        <div>
          <div className="text-xs text-gray-600">Direzione</div>
          <select className="input" value={sortDir} onChange={(e) => setSortDir(e.target.value as any)}>
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>
      </div>
      {loading && <div>Caricamento…</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="p-2">#</th>
              <th className="p-2">Prodotto</th>
              <th className="p-2">Taglia</th>
              <th className="p-2">Quantità</th>
              <th className="p-2">Prezzo</th>
              <th className="p-2">Totale</th>
              <th className="p-2">Nota</th>
              <th className="p-2">Data</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => {
              const qty = Math.abs(r.qty_change);
              const lineTotal = (r.sale_price ?? 0) * qty;
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.id}</td>
                  <td className="p-2">{r.product?.title || `ID ${r.product_id}`}</td>
                  <td className="p-2">{r.product?.size || ""}</td>
                  <td className="p-2">{qty}</td>
                  <td className="p-2">{currency(r.sale_price)}</td>
                  <td className="p-2">{currency(lineTotal)}</td>
                  <td className="p-2">{r.note || ""}</td>
                  <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div className="text-sm">Pagina {page} di {totalPages}</div>
        <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Prev
        </button>
        <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
          Next
        </button>
        <select
          className="input w-[100px]"
          value={perPage}
          onChange={(e) => {
            setPerPage(Number(e.target.value));
            setPage(1);
          }}
        >
          <option value={10}>10</option>
          <option value={15}>15</option>
          <option value={20}>20</option>
        </select>
      </div>
    </div>
  );
}
