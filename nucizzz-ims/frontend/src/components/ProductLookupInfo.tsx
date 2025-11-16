import React from "react";
import type { ProductEnrichment } from "../lib/product-lookup";

interface Props {
  data: ProductEnrichment | null;
  loading?: boolean;
}

export default function ProductLookupInfo({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-3 text-sm text-gray-600">
        Ricerca informazioni pubbliche...
      </div>
    );
  }

  if (!data) return null;

  if (!data.found) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-3 text-sm text-gray-500">
        Nessuna informazione pubblica trovata per {data.gtin}. Procedi pure manualmente.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-100">
      <div className="flex items-start gap-3">
        {data.image?.url && (
          <img
            src={data.image.url}
            alt={data.title || "Anteprima"}
            className="h-16 w-16 rounded-lg object-cover"
          />
        )}
        <div className="flex-1 space-y-1">
          <div className="text-base font-semibold">{data.title || "Titolo non disponibile"}</div>
          {data.brand && <div>Brand: {data.brand}</div>}
          {data.description && (
            <div className="text-xs text-emerald-900/80 dark:text-emerald-100/80 line-clamp-3">{data.description}</div>
          )}
          <div className="text-xs uppercase">
            Fonte: {data.source || "sconosciuta"} &middot; GTIN {data.gtin}
          </div>
        </div>
      </div>
    </div>
  );
}

