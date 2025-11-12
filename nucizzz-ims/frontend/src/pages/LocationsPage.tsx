import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function LocationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await api.get("/locations");
    setRows(res.data);
  }

  async function add() {
    try {
      await api.post("/locations", { name });
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
