// frontend/src/pages/ReceivePage.tsx
import React, { useEffect, useState } from "react";
import { api } from "../api";
import Scanner from "../components/Scanner";
import { lookupBarcode } from "../lib/barcode-lookup";

export default function ReceivePage() {
  const [form, setForm] = useState({
    barcode: "",
    title: "",
    brand: "",
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
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingBarcode, setLoadingBarcode] = useState(false);
  const [existingProduct, setExistingProduct] = useState<any>(null);
  const [showAddStockDialog, setShowAddStockDialog] = useState(false);
  const [addStockQty, setAddStockQty] = useState(1);
  const [addStockLocation, setAddStockLocation] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/locations/");
        const payload = r.data;
        setLocations(Array.isArray(payload) ? payload : []);
        if (!Array.isArray(payload)) {
          setErr("Risposta locations non valida");
        }
      } catch {
        setErr("Errore caricamento locations");
      }
    })();
  }, []);

  async function checkExistingProduct(barcode: string) {
    try {
      const res = await api.get(`/products/barcode/${encodeURIComponent(barcode)}`);
      return res.data;
    } catch {
      return null;
    }
  }

  async function addStockToExisting() {
    if (!existingProduct || !addStockLocation) {
      setErr("Seleziona una location");
      return;
    }
    
    setMsg(null);
    setErr(null);
    try {
      await api.post("/stock/movement", {
        product_id: existingProduct.id,
        type: "in",
        qty_change: addStockQty,
        from_location_id: null,
        to_location_id: locations.find(l => l.name === addStockLocation)?.id || null,
        note: "Ricezione merce",
      });
      setMsg(`Aggiunte ${addStockQty} unità in "${addStockLocation}" per prodotto #${existingProduct.id}`);
      setShowAddStockDialog(false);
      setExistingProduct(null);
      setAddStockQty(1);
      setAddStockLocation("");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e.message || "Errore aggiunta stock");
    }
  }

  async function submit() {
    if (!form.barcode || !form.title) {
      setErr("Barcode e Titolo sono obbligatori");
      return;
    }

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
        `Prodotto creato${
          res.data?.shopify_product_id ? " e sincronizzato su Shopify" : ""
        }: #${res.data?.id}${form.location ? ` - Stock aggiunto in "${form.location}"` : ""}`
      );
      // pulizia form dopo salvataggio
      setForm({
        barcode: "",
        title: "",
        brand: "",
        description: "",
        size: "",
        price_eur: "",
        cost_eur: "",
        weight_g: "",
        package_required: "",
        location: form.location, // Mantieni la location selezionata
        image_url: "",
      });
      setExistingProduct(null);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e.message || "Errore salvataggio");
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Ricezione merce</h2>

      <Scanner
        onDetected={async (code) => {
          setForm((f) => ({ ...f, barcode: code }));
          setLoadingBarcode(true);
          setErr(null);
          setMsg(null);
          setExistingProduct(null);
          
          // Verifica se il prodotto esiste già
          const existing = await checkExistingProduct(code);
          
          if (existing) {
            // Prodotto esistente: mostra dialog per aggiungere stock
            setExistingProduct(existing);
            setShowAddStockDialog(true);
            setLoadingBarcode(false);
            return;
          }
          
          // Prodotto non esiste: cerca informazioni e mostra form
          try {
            const productInfo = await lookupBarcode(code);
            if (productInfo) {
              setForm((f) => ({
                ...f,
                barcode: code,
                title: productInfo.title || "",
                brand: productInfo.brand || "",
                description: productInfo.description || "",
                image_url: productInfo.image_url || "",
                weight_g: productInfo.weight || "",
              }));
              setMsg("Informazioni prodotto caricate automaticamente dal database barcode!");
            } else {
              setForm((f) => ({ ...f, barcode: code }));
              setMsg("Barcode scansionato. Inserisci le informazioni prodotto.");
            }
          } catch (e) {
            console.warn("Errore ricerca barcode:", e);
            setForm((f) => ({ ...f, barcode: code }));
            setMsg("Barcode scansionato. Inserisci le informazioni prodotto.");
          } finally {
            setLoadingBarcode(false);
          }
        }}
        onError={(m) => setErr(m)}
      />
      
      {loadingBarcode && (
        <div className="text-sm text-blue-600">Ricerca informazioni prodotto...</div>
      )}

      {/* Dialog per aggiungere stock a prodotto esistente */}
      {showAddStockDialog && existingProduct && (
        <div className="card bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-lg">Prodotto già presente nel sistema</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>{existingProduct.title}</strong> (Barcode: {existingProduct.barcode})
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              SKU: {existingProduct.sku} • Brand: {existingProduct.brand || "N/A"}
            </p>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Quantità da aggiungere</label>
              <input
                type="number"
                min="1"
                value={addStockQty}
                onChange={(e) => setAddStockQty(Number(e.target.value) || 1)}
                className="input mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Location</label>
              <select
                value={addStockLocation}
                onChange={(e) => setAddStockLocation(e.target.value)}
                className="input mt-1"
                required
              >
                <option value="">Seleziona location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.name}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={addStockToExisting}
              className="btn bg-green-600 text-white hover:bg-green-700"
            >
              Aggiungi Stock
            </button>
            <button
              onClick={() => {
                setShowAddStockDialog(false);
                setExistingProduct(null);
                setAddStockQty(1);
                setAddStockLocation("");
              }}
              className="btn bg-gray-200 hover:bg-gray-300"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Form per nuovo prodotto (mostra solo se non c'è prodotto esistente) */}
      {!showAddStockDialog && (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            <input
              className="input"
              placeholder="Barcode *"
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="Titolo *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="Brand"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
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
            <div>
              <div className="text-xs text-gray-600">Sede</div>
              <select className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
                <option value="">Seleziona</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.name}>{l.name}</option>
                ))}
              </select>
            </div>
            <input
              className="input"
              placeholder="URL immagine (opz.)"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            />
            <div className="flex items-center gap-2">
              <input type="file" accept="image/*" onChange={async (e) => {
                if (!e.target.files || e.target.files.length === 0) return;
                setUploading(true);
                try {
                  const fd = new FormData();
                  fd.append("file", e.target.files[0]);
                  const r = await api.post("/uploads/", fd);
                  setForm((f) => ({ ...f, image_url: r.data.url }));
                } catch (err) {
                  setErr("Errore upload immagine");
                } finally {
                  setUploading(false);
                }
              }} />
              {uploading && <span className="text-xs text-gray-600">Caricamento…</span>}
            </div>
          </div>

          <button className="btn bg-black text-white" onClick={submit}>
            Crea Prodotto
          </button>
        </>
      )}

      {msg && <p className="text-green-600">{msg}</p>}
      {err && <p className="text-red-600">{err}</p>}
    </div>
  );
}
