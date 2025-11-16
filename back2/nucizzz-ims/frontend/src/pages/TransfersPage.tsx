import React, { useState } from "react";
import { api } from "../api";

export default function TransfersPage() {
  const [form, setForm] = useState({
    product_id: "",
    from_location_id: "",
    to_location_id: "",
    qty: "1",
  });
  const [msg, setMsg] = useState("");

  function set<K extends keyof typeof form>(k: K, v: any) {
    setForm({ ...form, [k]: v });
  }

  async function submit() {
    try {
      await api.post("/stock/movement", {
        product_id: Number(form.product_id),
        type: "transfer",
        qty_change: Number(form.qty),
        from_location_id: Number(form.from_location_id),
        to_location_id: Number(form.to_location_id),
        note: "Trasferimento",
      });
      setMsg("OK trasferito");
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "Errore trasferimento");
    }
  }

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Trasferimenti</h1>
      <div className="grid md:grid-cols-2 gap-3">
        <input
          className="input"
          placeholder="Product ID"
          value={form.product_id}
          onChange={(e) => set("product_id", e.target.value)}
        />
        <input
          className="input"
          placeholder="Da Location ID"
          value={form.from_location_id}
          onChange={(e) => set("from_location_id", e.target.value)}
        />
        <input
          className="input"
          placeholder="A Location ID"
          value={form.to_location_id}
          onChange={(e) => set("to_location_id", e.target.value)}
        />
        <input
          className="input"
          placeholder="Qty"
          value={form.qty}
          onChange={(e) => set("qty", e.target.value)}
        />
      </div>
      <button className="btn" onClick={submit}>
        Trasferisci
      </button>
      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}
