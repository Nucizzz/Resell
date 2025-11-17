import { useMemo } from "react";
import { useBarcodeLookup } from "./useBarcodeLookup";
import { LookupProductDTO } from "./types";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onAutofill: (dto: LookupProductDTO) => void;
};

export default function BarcodeField({ value, onChange, onAutofill }: Props) {
  const { state, detail, data, lookup } = useBarcodeLookup();

  const statusMessage = useMemo(() => {
    if (state === "loading") return "🔎 Ricerca in corso…";
    if (state === "found") return `✅ Trovato da ${detail.source}`;
    if (state === "empty") return "ℹ️ Nessun risultato (database vuoto)";
    if (state === "error") return `⚠️ Errore: ${detail.code ?? "ERRORE"} — ${detail.message ?? ""}`;
    return null;
  }, [state, detail]);

  const triggerLookup = () => {
    if (value.trim()) {
      lookup(value);
    }
  };

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-white shadow-sm">
      <label className="block text-sm font-medium text-gray-700">Barcode</label>
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={triggerLookup}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            triggerLookup();
          }
        }}
        placeholder="EAN/UPC/GTIN"
      />
      {statusMessage && <p className="text-sm">{statusMessage}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
          onClick={triggerLookup}
        >
          Riprova
        </button>
        {state === "found" && data && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              onAutofill(data);
            }}
          >
            Compila campi
          </button>
        )}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-gray-600">Dettagli tecnici</summary>
        <pre className="bg-gray-50 rounded p-2 text-xs overflow-auto">
          {JSON.stringify(detail, null, 2)}
        </pre>
      </details>
    </div>
  );
}
