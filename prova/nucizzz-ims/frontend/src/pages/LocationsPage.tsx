import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function LocationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const res = await api.get("/locations/");
      const payload = res.data;
      if (Array.isArray(payload)) {
        setRows(payload);
      } else if (payload && Array.isArray((payload as any).items)) {
        setRows((payload as any).items);
      } else {
        console.error("Unexpected /locations response shape:", payload);
        setRows([]);
      }
    } catch (err) {
      console.error("Error loading locations:", err);
      setRows([]);
    }
  }

  async function add() {
    try {
      const n = name.trim();
      if (!n) { setMsg("Nome richiesto"); return; }
      await api.post("/locations/", { name: n });
      setName("");
      await load();
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "Errore");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Sedi/Location</h1>
      <p className="text-sm text-gray-600">Crea le sedi da usare nella vendita e nell'inventario.</p>
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="Nome sede"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn" onClick={add}>
          Aggiungi
        </button>
      </div>
      <ul className="list-disc pl-6">
        {rows.map((l) => (
          <li key={l.id}>{l.name}</li>
        ))}
      </ul>
      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}
