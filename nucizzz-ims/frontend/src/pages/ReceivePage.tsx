// frontend/src/pages/ReceivePage.tsx
import React, { useState } from "react";
import { api } from "../api";
import Scanner from "../components/Scanner";
import { lookupBarcode } from "../lib/barcode-lookup";
import { useLocationSelection } from "../contexts/LocationContext";
import { useNavigate } from "react-router-dom";

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
    image_url: "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingBarcode, setLoadingBarcode] = useState(false);
  const [existingProduct, setExistingProduct] = useState<any>(null);
  const [showAddStockDialog, setShowAddStockDialog] = useState(false);
  const [addStockQty, setAddStockQty] = useState(1);
  const { mode, location: currentLocation, openSelector } = useLocationSelection();
  const activeLocationId = mode === "location" ? currentLocation?.id ?? null : null;
  const activeLocationName = mode === "location" ? currentLocation?.name ?? "" : "";
  const [manualLocationBarcode, setManualLocationBarcode] = useState("");
  const [notRegisteredBarcode, setNotRegisteredBarcode] = useState<string | null>(null);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const navigate = useNavigate();

  function resetOperationalState() {
    setManualLocationBarcode("");
    setExistingProduct(null);
    setShowAddStockDialog(false);
    setAddStockQty(1);
    setNotRegisteredBarcode(null);
    setLastScannedBarcode(null);
    setMsg(null);
    setErr(null);
  }

  async function checkExistingProduct(barcode: string) {
    try {
      const res = await api.get(`/products/barcode/${encodeURIComponent(barcode)}`);
      return res.data;
    } catch {
      return null;
    }
  }

  async function addStockToExisting() {
    if (!existingProduct || !activeLocationId) {
      setErr("Seleziona una location operativa per aggiungere stock");
      if (!activeLocationId) openSelector();
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
        to_location_id: activeLocationId,
        note: "Ricezione merce",
      });
      setMsg(`Aggiunte ${addStockQty} unità in "${activeLocationName}" per prodotto #${existingProduct.id}`);
      setShowAddStockDialog(false);
      setExistingProduct(null);
      setAddStockQty(1);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e.message || "Errore aggiunta stock");
    }
  }

  async function handleLocationScan(code: string) {
    if (!activeLocationId) return;
    setManualLocationBarcode(code);
    setLastScannedBarcode(code);
    setLoadingBarcode(true);
    setErr(null);
    setMsg(null);
    setExistingProduct(null);
    setShowAddStockDialog(false);
    setNotRegisteredBarcode(null);

    const existing = await checkExistingProduct(code);
    if (existing) {
      setExistingProduct(existing);
      setShowAddStockDialog(true);
      setLoadingBarcode(false);
      return;
    }

    setNotRegisteredBarcode(code);
    setLoadingBarcode(false);
  }

  async function handleGeneralScan(code: string) {
    setForm((f) => ({ ...f, barcode: code }));
    setLastScannedBarcode(code);
    setLoadingBarcode(true);
    setErr(null);
    setMsg(null);
    setExistingProduct(null);

    const existing = await checkExistingProduct(code);

    if (existing) {
      setExistingProduct(existing);
      setShowAddStockDialog(true);
      setLoadingBarcode(false);
      return;
    }

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
  }

  async function handleScan(code: string) {
    if (activeLocationId) {
      await handleLocationScan(code);
    } else {
      await handleGeneralScan(code);
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
        location: activeLocationName || undefined,
      });
      setMsg(
        `Prodotto creato${
          res.data?.shopify_product_id ? " e sincronizzato su Shopify" : ""
        }: #${res.data?.id}${activeLocationName ? ` - Stock aggiunto in "${activeLocationName}"` : ""}`
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
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4 text-sm">
        {activeLocationId ? (
          <p>
            Operi su <span className="font-semibold">{currentLocation?.name}</span>. Tutto lo stock verrà aggiunto automaticamente a questa sede.
          </p>
        ) : (
          <div className="space-y-2">
            <p>
              Modalità generale attiva: registri solo l'anagrafica dei prodotti senza aggiungere stock.
            </p>
            <button className="btn" onClick={openSelector}>Scegli una location</button>
          </div>
        )}
      </div>

      <Scanner onDetected={handleScan} onError={(m) => setErr(m)} />

      {lastScannedBarcode && (
        <div className="text-xs text-gray-500">
          Ultimo barcode letto:
          <span className="font-mono font-semibold ml-1">{lastScannedBarcode}</span>
        </div>
      )}

      {loadingBarcode && !activeLocationId && (
        <div className="text-sm text-blue-600">Ricerca informazioni prodotto...</div>
      )}

      {/* Sezione operativa per le location */}
      {activeLocationId && (
        <div className="space-y-3">
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <div className="text-xs text-gray-600">Barcode manuale</div>
              <input
                className="input"
                placeholder="Inserisci barcode"
                value={manualLocationBarcode}
                onChange={(e) => setManualLocationBarcode(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                className="btn"
                onClick={() => {
                  if (manualLocationBarcode) {
                    handleLocationScan(manualLocationBarcode);
                  }
                }}
                disabled={!manualLocationBarcode}
              >
                Cerca
              </button>
              <button className="btn bg-gray-100" onClick={resetOperationalState}>
                Reset
              </button>
            </div>
          </div>

          {loadingBarcode && (
            <div className="text-xs text-gray-500">Sto cercando il prodotto…</div>
          )}

          {/* Dialog per aggiungere stock a prodotto esistente */}
          {showAddStockDialog && existingProduct && (
            <div className="card bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Prodotto trovato</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>{existingProduct.title}</strong> (Barcode: {existingProduct.barcode || "N/A"})
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
                    onChange={(e) => setAddStockQty(Math.max(1, Number(e.target.value) || 1))}
                    className="input mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Location</label>
                  <div className="input mt-1 bg-gray-100 dark:bg-gray-800">
                    {activeLocationName || "Nessuna"}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={addStockToExisting} className="btn bg-green-600 text-white hover:bg-green-700">
                  Aggiungi Stock
                </button>
                <button
                  onClick={() => {
                    setShowAddStockDialog(false);
                    setExistingProduct(null);
                    setAddStockQty(1);
                  }}
                  className="btn bg-gray-200 hover:bg-gray-300"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}

          {notRegisteredBarcode && (
            <div className="card border border-dashed border-red-300 bg-red-50/60 dark:bg-red-900/20 space-y-3">
              <div className="font-semibold">Barcode non registrato</div>
              <p className="text-sm text-gray-600">
                Il codice <strong>{notRegisteredBarcode}</strong> non è presente nel sistema. Registra prima il prodotto e poi
                potrai aggiungere lo stock alla sede.
              </p>
              <button
                className="btn bg-black text-white"
                onClick={() => navigate(`/products/new?barcode=${encodeURIComponent(notRegisteredBarcode)}`)}
              >
                Vai alla pagina "Nuovo prodotto"
              </button>
            </div>
          )}
        </div>
      )}

      {/* Dialog per aggiungere stock a prodotto esistente in modalità generale */}
      {!activeLocationId && showAddStockDialog && existingProduct && (
        <div className="card bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-lg">Prodotto già presente nel sistema</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>{existingProduct.title}</strong> (Barcode: {existingProduct.barcode || "N/A"}) è già registrato.
            </p>
          </div>
          <p className="text-sm text-gray-600">
            Per aggiungere stock a questo articolo seleziona prima la location operativa e poi scansiona nuovamente il codice.
          </p>
          <div className="flex gap-2">
            <button className="btn" onClick={openSelector}>Apri selettore location</button>
            <button
              className="btn bg-gray-200"
              onClick={() => {
                setShowAddStockDialog(false);
                setExistingProduct(null);
              }}
            >
              Chiudi
            </button>
          </div>
        </div>
      )}

      {/* Form per nuovo prodotto (mostra solo in modalità generale) */}
      {!activeLocationId && !showAddStockDialog && (
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
