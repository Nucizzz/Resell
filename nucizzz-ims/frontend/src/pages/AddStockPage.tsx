import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useLocationSelection } from "../contexts/LocationContext";
import ScanInput from "../components/ScanInput";
import BarcodeModal from "../components/BarcodeModal";
import ProductLookupInfo from "../components/ProductLookupInfo";
import { lookupProduct, type ProductEnrichment } from "../lib/product-lookup";

export default function AddStockPage() {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<any | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { mode, location: currentLocation, openSelector } = useLocationSelection();
  const [scannerOpen, setScannerOpen] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const [lookupInfo, setLookupInfo] = useState<ProductEnrichment | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const activeLocationId = mode === "location" ? currentLocation?.id ?? null : null;

  async function onDetected(code: string) {
    if (!code) return;
    setScannerOpen(false);
    setBarcode(code);
    setProduct(null);
    setMatches([]);
    setMessage("");
    setLookupInfo(null);
    setLookupLoading(true);
    try {
      const info = await lookupProduct(code);
      setLookupInfo(info);
    } catch {
      setLookupInfo(null);
    } finally {
      setLookupLoading(false);
    }
    if (!code) return;
    setLoading(true);
    try {
      const res = await api.get(`/products/barcode/${encodeURIComponent(code)}/all`);
      const list = Array.isArray(res.data) ? res.data : [res.data];
      setMatches(list);
      if (list.length === 1) {
        setProduct(list[0]);
      }
      if (list.length === 0) {
        setMessage("Barcode non riconosciuto.");
      }
    } catch {
      setProduct(null);
      setMatches([]);
      setMessage("Barcode non riconosciuto.");
    }
    setLoading(false);
  }

  async function addOne() {
    if (!product || !activeLocationId) {
      if (!activeLocationId) {
        setMessage("Seleziona prima una location dalla barra in alto.");
        openSelector();
      }
      return;
    }
    try {
      await api.post("/stock/movement", {
        product_id: product.id,
        type: "in",
        qty_change: 1,
        from_location_id: null,
        to_location_id: activeLocationId,
        note: "Aggiunta rapida",
      });
      setMessage(`Aggiunto 1 pezzo a ${currentLocation?.name}.`);
    } catch (e: any) {
      setMessage(e?.response?.data?.detail || "Errore durante l'aggiunta");
    }
  }

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Aggiungi stock</h1>
      {!activeLocationId && (
        <div className="rounded-lg border border-dashed border-yellow-500 bg-yellow-50 p-3 text-sm text-yellow-800">
          Seleziona una location per assegnare correttamente lo stock.
        </div>
      )}
      <ScanInput
        ref={barcodeInputRef}
        placeholder="Scansiona o inserisci barcode"
        value={barcode}
        onChange={setBarcode}
        onScan={onDetected}
        onRequestScan={() => setScannerOpen(true)}
      />
      <div className="flex justify-end">
        <button className="btn" onClick={() => onDetected(barcode)} disabled={!barcode}>
          Cerca
        </button>
      </div>
      <ProductLookupInfo data={lookupInfo} loading={lookupLoading} />
      <BarcodeModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={onDetected}
        focusRef={barcodeInputRef}
      />
      {loading && <div className="text-sm">Ricerca in corso…</div>}
      {matches.length > 1 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Seleziona il prodotto da aggiornare:</div>
          {matches.map((item) => (
            <div key={item.id} className="card cursor-pointer hover:bg-gray-50" onClick={() => setProduct(item)}>
              <div className="font-medium">{item.title}</div>
              <div className="text-xs text-gray-500">SKU {item.sku}</div>
            </div>
          ))}
        </div>
      )}
      {product ? (
        <div className="card space-y-2">
          <div className="font-medium">{product.title}</div>
          <div className="text-sm text-gray-600">
            SKU {product.sku} • Taglia {product.size || "N/D"}
          </div>
          <button className="btn" onClick={addOne}>
            Aggiungi +1
          </button>
          {message && <div className="text-xs text-gray-500">{message}</div>}
        </div>
      ) : (
        message && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 space-y-2">
            <div>{message}</div>
            <Link to="/products/new" className="btn inline-flex">
              Vai a Nuovo prodotto
            </Link>
          </div>
        )
      )}
    </div>
  );
}
