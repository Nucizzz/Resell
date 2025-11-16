import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";

type Product = { id: number; price?: number };
type Movement = { id: number; type: string; qty_change: number; created_at: string };

export default function AnalyticsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Movement[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await api.get("/products/", { params: { limit: 500 } });
        const list = Array.isArray(p.data) ? p.data : [];
        setProducts(list);
        if (!Array.isArray(p.data)) setErr("Risposta prodotti non valida");
      } catch {
        setErr("Errore caricamento prodotti per analisi");
      }
      try {
        const s = await api.get("/stock/movements", { params: { type: "sell", limit: 500 } });
        const rows = Array.isArray(s.data) ? s.data : [];
        setSales(rows);
        if (!Array.isArray(s.data)) setErr((prev) => prev || "Risposta vendite non valida");
      } catch {
        setErr((prev) => prev || "Errore caricamento vendite per analisi");
      }
    })();
  }, []);

  const kpis = useMemo(() => {
    const totalProducts = products.length;
    const avgPrice = products.reduce((sum, p) => sum + (p.price || 0), 0) / (products.length || 1);
    const totalSales = sales.length;
    const today = new Date();
    const todaySales = sales.filter((s) => {
      const d = new Date(s.created_at);
      return d.toDateString() === today.toDateString();
    }).length;
    const revenue = sales.reduce((acc, m) => {
      const p = products.find((x) => x.id === (m as any).product_id);
      const unit = p?.price || 0;
      const qty = Math.abs(m.qty_change || 0);
      return acc + unit * qty;
    }, 0);
    return { totalProducts, avgPrice, totalSales, todaySales, revenue };
  }, [products, sales]);

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Analisi negozio</h1>
      {err && <div className="text-red-600">{err}</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card"><div className="text-sm text-gray-600">Prodotti</div><div className="text-2xl font-semibold">{kpis.totalProducts}</div></div>
        <div className="card"><div className="text-sm text-gray-600">Prezzo medio</div><div className="text-2xl font-semibold">{kpis.avgPrice.toFixed(2)}</div></div>
        <div className="card"><div className="text-sm text-gray-600">Vendite totali</div><div className="text-2xl font-semibold">{kpis.totalSales}</div></div>
        <div className="card"><div className="text-sm text-gray-600">Vendite oggi</div><div className="text-2xl font-semibold">{kpis.todaySales}</div></div>
        <div className="card md:col-span-2"><div className="text-sm text-gray-600">Ricavi stimati</div><div className="text-2xl font-semibold">{kpis.revenue.toFixed(2)}</div></div>
      </div>
      <div className="card">
        <div className="font-medium mb-2">Marche più vendute</div>
        <BrandBreakdown products={products} sales={sales} />
      </div>
    </div>
  );
}

function BrandBreakdown({ products, sales }: { products: any[]; sales: Movement[] }) {
  const rows = useMemo(() => {
    const count: Record<string, number> = {};
    for (const s of sales) {
      const p = products.find((x) => x.id === (s as any).product_id);
      const b = (p as any)?.brand || "";
      if (!b) continue;
      count[b] = (count[b] || 0) + Math.abs(s.qty_change || 0);
    }
    return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [products, sales]);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {rows.map(([b, n]) => (
        <div key={b} className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-700">
          <div className="text-sm">{b}</div>
          <div className="text-xs text-gray-600">{n} pezzi</div>
        </div>
      ))}
      {rows.length === 0 && <div className="text-sm text-gray-500">Nessun dato</div>}
    </div>
  );
}