import React, { useState } from "react";
import { api } from "../api";

export default function ProductFormPage() {
  const [form, setForm] = useState({
    sku: "",
    barcode: "",
    title: "",
    brand: "",
    description: "",
    size: "",
    color: "",
    weight_grams: "",
    package_required: "",
    cost: "",
    price: "",
    image_url: "",
  });
  const [msg, setMsg] = useState("");

  function set<K extends keyof typeof form>(k: K, v: any) {
    setForm({ ...form, [k]: v });
  }

  async function submit() {
    try {
      await api.post("/products", {
        ...form,
        weight_grams: form.weight_grams ? Number(form.weight_grams) : null,
        cost: form.cost ? Number(form.cost) : null,
        price: form.price ? Number(form.price) : null,
        initial_qty: 0,
      });
      setMsg("Prodotto creato.");
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "Errore creazione");
    }
  }

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Nuovo prodotto</h1>
      <div className="grid md:grid-cols-2 gap-3">
        <input
          className="input"
          placeholder="SKU"
          value={form.sku}
          onChange={(e) => set("sku", e.target.value)}
        />
        <input
          className="input"
          placeholder="Barcode"
          value={form.barcode}
          onChange={(e) => set("barcode", e.target.value)}
        />
        <input
          className="input"
          placeholder="Titolo"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
        />
        <input
          className="input"
          placeholder="Brand"
          value={form.brand}
          onChange={(e) => set("brand", e.target.value)}
        />
        <input
          className="input"
          placeholder="Taglia"
          value={form.size}
          onChange={(e) => set("size", e.target.value)}
        />
        <input
          className="input"
          placeholder="Colore"
          value={form.color}
          onChange={(e) => set("color", e.target.value)}
        />
        <input
          className="input"
          placeholder="Peso (g)"
          value={form.weight_grams}
          onChange={(e) => set("weight_grams", e.target.value)}
        />
        <input
          className="input"
          placeholder="Pacco richiesto"
          value={form.package_required}
          onChange={(e) => set("package_required", e.target.value)}
        />
        <input
          className="input"
          placeholder="Costo"
          value={form.cost}
          onChange={(e) => set("cost", e.target.value)}
        />
        <input
          className="input"
          placeholder="Prezzo"
          value={form.price}
          onChange={(e) => set("price", e.target.value)}
        />
        <input
          className="input"
          placeholder="Immagine URL"
          value={form.image_url}
          onChange={(e) => set("image_url", e.target.value)}
        />
        <textarea
          className="input"
          placeholder="Descrizione"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>
      <button className="btn" onClick={submit}>
        Salva
      </button>
      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}
