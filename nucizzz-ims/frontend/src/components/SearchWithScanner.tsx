import React, { useEffect, useState } from "react";
import { Barcode, Keyboard, Loader2, ScanLine, ScanText, Zap } from "lucide-react";
import Scanner from "./Scanner";
import { DetectedPayload } from "../utils/barcode";

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
  const [code128Session, setCode128Session] = useState(false);
  const [statusBars, setStatusBars] = useState({ light: 0.6, stability: 1, roiFill: 0 });

  useEffect(() => {
    setCode128Session(Boolean(enableCode128));
  }, [enableCode128]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const { body } = document;
    if (scannerOpen) {
      body.style.setProperty("overflow", "hidden");
    } else {
      setScannerError(null);
      body.style.removeProperty("overflow");
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

  const handleBarcode = async (payload: DetectedPayload) => {
    const code = payload.normalized.primary || payload.raw;
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
      return;
    }
    if (!continuousScan) {
      setScannerOpen(false);
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
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setScannerOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4">
            <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
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
                <Scanner
                  onDetected={handleBarcode}
                  onError={(msg) => setScannerError(msg)}
                  enableCode128={code128Session}
                  onStatus={(s) => setStatusBars(s)}
                />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
                <input type="checkbox" checked={continuousScan} onChange={(e) => setContinuousScan(e.target.checked)} />
                <span className="flex items-center gap-1"><ScanLine className="h-4 w-4" /> Scansione continua</span>
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
                <input
                  type="checkbox"
                  checked={code128Session}
                  onChange={(e) => setCode128Session(e.target.checked)}
                />
                <span className="flex items-center gap-1"><ScanText className="h-4 w-4" /> Sessione Code128</span>
              </label>
            </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1">
                    <Zap className="h-3 w-3" /> Fallback ZXing
                  </span>
                </div>
            <div className="grid grid-cols-3 gap-3 text-xs text-gray-600">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Stabilità</span>
                  <span>{Math.round(statusBars.stability * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.min(statusBars.stability, 1) * 100}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Luce</span>
                  <span>{Math.round(statusBars.light * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${Math.min(statusBars.light, 1) * 100}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">ROI</span>
                  <span>{Math.round(statusBars.roiFill * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-sky-500"
                    style={{ width: `${Math.min(statusBars.roiFill, 1) * 100}%` }}
                  />
                </div>
              </div>
            </div>
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
        </>
      )}
    </div>
  );
}
