import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

export default function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const res = await api.get(`/products/${id}`);
        setForm({
          sku: res.data.sku || "",
          barcode: res.data.barcode || "",
          title: res.data.title || "",
          brand: res.data.brand || "",
          description: res.data.description || "",
          size: res.data.size || "",
          color: res.data.color || "",
          weight_grams: String(res.data.weight_grams ?? ""),
          package_required: res.data.package_required || "",
          cost: String(res.data.cost ?? ""),
          price: String(res.data.price ?? ""),
          image_url: res.data.image_url || "",
        });
      } catch {}
    }
    load();
  }, [id]);

  useEffect(() => {
    if (id) return;
    const presetBarcode = searchParams.get("barcode");
    if (presetBarcode) {
      setForm((prev) => ({ ...prev, barcode: presetBarcode }));
    }
  }, [id, searchParams]);

  function set<K extends keyof typeof form>(k: K, v: any) {
    setForm({ ...form, [k]: v });
  }

  async function submit() {
    try {
      const payload = {
        ...form,
        weight_grams: form.weight_grams ? Number(form.weight_grams) : null,
        cost: form.cost ? Number(form.cost) : null,
        price: form.price ? Number(form.price) : null,
      };
      if (id) {
        await api.patch(`/products/${id}`, payload);
        setMsg("Prodotto aggiornato.");
      } else {
        await api.post("/products/", { ...payload, initial_qty: 0 });
        setMsg("Prodotto creato.");
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail || "Errore creazione";
      // se lo SKU esiste già, mostra quello esistente
      try {
        if (detail.includes("SKU già presente") && form.sku) {
          const r = await api.get(`/products/`, { params: { q: form.sku, limit: 1 } });
          const ex = r.data?.[0];
          if (ex) {
            navigate(`/products/edit/${ex.id}`);
            return;
          }
        }
      } catch {}
      setMsg(detail);
    }
  }

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">{id ? "Modifica prodotto" : "Nuovo prodotto"}</h1>
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
