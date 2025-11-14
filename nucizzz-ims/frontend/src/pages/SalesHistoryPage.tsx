import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";

type Movement = {
  id: number;
  product_id: number;
  type: string;
  qty_change: number;
  note?: string;
  created_at: string;
};

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
      const res = await api.get("/stock/movements", { params: { type: "sell", limit: 200, from_dt: from || undefined, to_dt: to || undefined } });
      setRows(res.data);
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
    return rows.filter((r) => String(r.product_id).includes(s) || (r.note || "").toLowerCase().includes(s));
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
        return sortDir === "asc" ? a.qty_change - b.qty_change : b.qty_change - a.qty_change;
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

  function exportCsv() {
    const header = "id;product_id;qty;note;created_at\n";
    const body = filtered.map(r => `${r.id};${r.product_id};${Math.abs(r.qty_change)};${r.note || ""};${r.created_at}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vendite.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Storico vendite</h1>
      {err && <div className="text-red-600">{err}</div>}
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
          <input className="input" placeholder="ID prodotto o nota" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn" onClick={exportCsv}>Esporta CSV</button>
        <div>
          <div className="text-xs text-gray-600">Ordina per</div>
          <select className="input" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            <option value="created_at">Data</option>
            <option value="product_id">Prodotto</option>
            <option value="qty_change">Quantità</option>
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
              <th className="p-2">Quantità</th>
              <th className="p-2">Nota</th>
              <th className="p-2">Data</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.id}</td>
                <td className="p-2">{r.product_id}</td>
                <td className="p-2">{Math.abs(r.qty_change)}</td>
                <td className="p-2">{r.note || ""}</td>
                <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div className="text-sm">Pagina {page} di {totalPages}</div>
        <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
        <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
        <select className="input w-[100px]" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
          <option value={10}>10</option>
          <option value={15}>15</option>
          <option value={20}>20</option>
        </select>
      </div>
    </div>
  );
}