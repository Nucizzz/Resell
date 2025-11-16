import React, { useEffect, useMemo, useState } from "react";
import { Barcode, Keyboard, Loader2 } from "lucide-react";
import Scanner from "./Scanner";

export type SearchResult = {
  id: string;
  title: string;
  subtitle?: string;
  barcode?: string;
};

export type SearchItem = SearchResult;

export async function searchByText(query: string): Promise<SearchResult[]> {
  // Placeholder API stub: replace this block with a real HTTP request.
  // The function resolves with mock data so designers can validate the UI without a backend.
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (!query) return [];
  return [
    { id: `mock-${query}-1`, title: `Risultato per "${query}"`, subtitle: "Esempio prodotto", barcode: "1234567890123" },
    { id: `mock-${query}-2`, title: "Scarpa limited", subtitle: "Taglia 43", barcode: "0123456789012" },
  ];
}

export async function searchByBarcode(code: string): Promise<SearchItem> {
  // Placeholder API stub: plug your inventory lookup logic here.
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (!code) {
    throw new Error("Barcode non valido");
  }
  return {
    id: code,
    title: `Ultima scansione ${code}`,
    subtitle: "Sostituisci con i dati reali",
    barcode: code,
  };
}

type SearchWithScannerProps = {
  placeholder?: string;
  onTextSearch?: (query: string) => Promise<void> | void;
  onBarcodeDetected?: (barcode: string) => Promise<void> | void;
  enableCode128?: boolean;
  mockApis?: boolean;
};

export default function SearchWithScanner({
  placeholder = "Cerca prodotto o barcode",
  onTextSearch,
  onBarcodeDetected,
  enableCode128,
  mockApis = true,
}: SearchWithScannerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [continuousScan, setContinuousScan] = useState(true);
  const [recentScans, setRecentScans] = useState<string[]>([]);
  const [lastItem, setLastItem] = useState<SearchItem | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannerKey, setScannerKey] = useState(0);
  const [preferExternal, setPreferExternal] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const callbackCode = params.get("scan") || params.get("SCAN_RESULT");
    if (callbackCode) {
      handleBarcode(callbackCode);
      params.delete("scan");
      params.delete("SCAN_RESULT");
      const next = params.toString();
      const newUrl = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", newUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const { body } = document;
    if (!scannerOpen) {
      setScannerError(null);
      setScannerKey((prev) => prev + 1);
      body.style.removeProperty("overflow");
    } else {
      body.style.setProperty("overflow", "hidden");
    }
    return () => {
      body.style.removeProperty("overflow");
    };
  }, [scannerOpen]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    setIsSearching(true);
    if (mockApis) {
      const demo = await searchByText(term);
      setResults(demo);
    }
    try {
      await onTextSearch?.(term);
    } finally {
      setIsSearching(false);
    }
  };

  const handleBarcode = async (code: string) => {
    setScannerError(null);
    setRecentScans((prev) => [code, ...prev.filter((entry) => entry !== code)].slice(0, 6));
    if (mockApis) {
      try {
        const item = await searchByBarcode(code);
        setLastItem(item);
      } catch (err: any) {
        setLastItem(null);
        setScannerError(err?.message || "Errore ricerca barcode");
      }
    }
    try {
      await onBarcodeDetected?.(code);
    } catch (err: any) {
      setScannerError(err?.message || "Errore durante l'elaborazione del barcode");
    }
    if (!continuousScan) {
      setTimeout(() => setScannerOpen(false), 300);
    }
  };

  const modalClasses = useMemo(
    () =>
      `fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4 ${scannerOpen ? "" : "pointer-events-none"}`,
    [scannerOpen]
  );

  const externalScannerUrl = useMemo(() => {
    if (typeof window === "undefined") return "zxing://scan";
    const retUrl = `${window.location.origin}${window.location.pathname}?scan=%7BCODE%7D${window.location.hash}`;
    const formats = enableCode128
      ? "EAN_13,EAN_8,UPC_A,UPC_E,CODE_128"
      : "EAN_13,EAN_8,UPC_A,UPC_E";
    const intent = `zxing://scan/?ret=${encodeURIComponent(retUrl)}&SCAN_FORMATS=${formats}`;
    return intent;
  }, [enableCode128]);

  const triggerExternalScanner = () => {
    try {
      window.location.href = externalScannerUrl;
    } catch (err: any) {
      setScannerError("Impossibile aprire lo scanner esterno");
      console.error("External scanner launch failed", err);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="relative">
        <input
          className="input w-full pr-12"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 btn px-3 py-2"
          onClick={() => setScannerOpen(true)}
        >
          <Barcode className="h-4 w-4" />
        </button>
      </form>
      {isSearching && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Ricerca in corso…
        </div>
      )}
      {results.length > 0 && (
        <div className="rounded-2xl border border-gray-200 p-3 space-y-2">
          <div className="text-xs uppercase text-gray-500">Risultati (demo)</div>
          {results.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="font-medium">{item.title}</div>
              {item.subtitle && <div className="text-xs text-gray-500">{item.subtitle}</div>}
              {item.barcode && <div className="text-xs text-gray-400">Barcode: {item.barcode}</div>}
            </div>
          ))}
        </div>
      )}

      {scannerOpen && (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setScannerOpen(false)} />
      )}
      <div className={modalClasses}>
        <div
          className={`w-full max-w-3xl transform rounded-3xl bg-white shadow-2xl transition-all duration-300 ${
            scannerOpen ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <div className="text-sm font-medium">Scanner barcode</div>
              <p className="text-xs text-gray-500">Inquadra il codice nella fascia centrale e tienilo fermo</p>
            </div>
            <button className="btn" onClick={() => setScannerOpen(false)}>
              <Keyboard className="h-4 w-4" />
              <span className="ml-2">Tastiera</span>
            </button>
          </div>
          <div className="space-y-4 p-4">
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">Scanner esterno consigliato</div>
                  <p className="text-xs text-amber-800">
                    Usa l'app "ZXing Barcode Scanner" (gratuita) per massima precisione e restituisce il
                    codice a questa pagina.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={preferExternal}
                    onChange={(e) => setPreferExternal(e.target.checked)}
                  />
                  Preferisci app esterna
                </label>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="btn" onClick={triggerExternalScanner}>
                  Apri app ZXing
                </button>
                <a className="btn" href={externalScannerUrl} rel="noreferrer">
                  Link alternativo
                </a>
              </div>
              <p className="mt-2 text-xs text-amber-800">
                Se l'app è installata su Android/iOS aprirà lo scanner nativo; al ritorno il barcode appare in
                "Ultime scansioni".
              </p>
            </div>

            {!preferExternal && (
              <Scanner
                key={scannerKey}
                onDetected={handleBarcode}
                onError={(msg) => setScannerError(msg)}
                enableCode128={enableCode128}
              />
            )}

            {preferExternal && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                <div className="font-semibold">Scanner interno (backup)</div>
                <p className="text-xs text-gray-500">
                  Se l'app esterna non è disponibile, disattiva il toggle sopra per usare lo scanner in pagina.
                </p>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={continuousScan} onChange={(e) => setContinuousScan(e.target.checked)} />
              Scansione continua
            </label>
            <div>
              <div className="text-xs font-semibold uppercase text-gray-500">Ultime scansioni</div>
              {recentScans.length === 0 ? (
                <div className="text-sm text-gray-500">Ancora nessuna scansione.</div>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {recentScans.map((code) => (
                    <li key={code} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 font-mono text-xs">
                      {code}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {lastItem && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <div className="font-semibold">{lastItem.title}</div>
                {lastItem.subtitle && <div>{lastItem.subtitle}</div>}
                {lastItem.barcode && <div className="text-xs">Barcode: {lastItem.barcode}</div>}
              </div>
            )}
            {scannerError && <div className="text-sm text-red-600">{scannerError}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
