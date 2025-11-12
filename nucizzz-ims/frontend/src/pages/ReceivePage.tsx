// frontend/src/pages/ReceivePage.tsx
import React, { useState } from "react";
import { api } from "../api";
import Scanner from "../components/Scanner";

export default function ReceivePage() {
  const [form, setForm] = useState({
    barcode: "",
    title: "",
    description: "",
    size: "",
    price_eur: "" as string | number,
    cost_eur: "" as string | number,
    weight_g: "" as string | number,
    package_required: "",
    location: "",
    image_url: "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    setErr(null);
    try {
      const res = await api.post("/products/receive", {
        ...form,
        price_eur: form.price_eur ? Number(form.price_eur) : null,
        cost_eur: form.cost_eur ? Number(form.cost_eur) : null,
        weight_g: form.weight_g ? Number(form.weight_g) : null,
      });
      setMsg(
        `Prodotto salvato${
          res.data?.shopify_product_id ? " e sincronizzato su Shopify" : ""
        }: #${res.data?.id}`
      );
      // pulizia barcode (ma lasciamo altre info per inserimenti rapidi)
      setForm((f) => ({ ...f, barcode: "" }));
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e.message || "Errore salvataggio");
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Ricezione merce</h2>

      <Scanner
        onDetected={(code) => setForm((f) => ({ ...f, barcode: code }))}
        onError={(m) => setErr(m)}
      />

      <div className="grid md:grid-cols-2 gap-3">
        <input
          className="input"
          placeholder="Barcode"
          value={form.barcode}
          onChange={(e) => setForm({ ...form, barcode: e.target.value })}
        />
        <input
          className="input"
          placeholder="Titolo"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <input
          className="input"
          placeholder="Descrizione"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <input
          className="input"
          placeholder="Taglia"
          value={form.size}
          onChange={(e) => setForm({ ...form, size: e.target.value })}
        />
        <input
          className="input"
          placeholder="Prezzo EUR"
          type="number"
          step="0.01"
          value={form.price_eur}
          onChange={(e) => setForm({ ...form, price_eur: e.target.value })}
        />
        <input
          className="input"
          placeholder="Costo EUR"
          type="number"
          step="0.01"
          value={form.cost_eur}
          onChange={(e) => setForm({ ...form, cost_eur: e.target.value })}
        />
        <input
          className="input"
          placeholder="Peso (g)"
          type="number"
          value={form.weight_g}
          onChange={(e) => setForm({ ...form, weight_g: e.target.value })}
        />
        <input
          className="input"
          placeholder="Pacco richiesto (es. Box M)"
          value={form.package_required}
          onChange={(e) =>
            setForm({ ...form, package_required: e.target.value })
          }
        />
        <input
          className="input"
          placeholder="Sede (Negozio/Magazzino)"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
        <input
          className="input"
          placeholder="URL immagine (opz.)"
          value={form.image_url}
          onChange={(e) => setForm({ ...form, image_url: e.target.value })}
        />
      </div>

      <button className="btn bg-black text-white" onClick={submit}>
        Salva
      </button>

      {msg && <p className="text-green-600">{msg}</p>}
      {err && <p className="text-red-600">{err}</p>}
      <p className="text-xs text-gray-500">
        Regola anti-duplicazione: se il barcode esiste già nel database, il
        backend risponde con errore e non duplica.
      </p>
    </div>
  );
}
