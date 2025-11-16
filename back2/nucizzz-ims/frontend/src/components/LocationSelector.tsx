import React from "react";
import { useLocationSelection } from "../contexts/LocationContext";
import { useAuth } from "../contexts/AuthContext";

export default function LocationSelector() {
  const { isAuthenticated } = useAuth();
  const {
    locations,
    selectGeneral,
    selectLocation,
    refreshLocations,
    isSelectorOpen,
    hasSelection,
    loadingLocations,
    closeSelector,
  } = useLocationSelection();

  if (!isAuthenticated || !isSelectorOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-900 p-6 space-y-5 shadow-2xl">
        <div className="space-y-1 text-center">
          <p className="text-sm uppercase tracking-wide text-gray-500">Modalità operativa</p>
          <h2 className="text-2xl font-semibold">Scegli dove vuoi lavorare</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Puoi sempre cambiare sede dal menu superiore. La modalità Generale permette solo consultazione
            e anagrafica prodotti.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <button
            onClick={selectGeneral}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/70 px-4 py-5 text-left hover:border-black focus:outline-none focus:ring-2 focus:ring-black"
          >
            <div className="text-xs uppercase tracking-wide text-gray-500">Modalità</div>
            <div className="text-lg font-semibold">Vista generale</div>
            <p className="text-sm text-gray-500 mt-1">
              Consulta lo stock aggregato, crea nuovi prodotti e fai analisi senza toccare le giacenze.
            </p>
          </button>

          {locations.map((loc) => (
            <button
              key={loc.id}
              onClick={() => selectLocation(loc)}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-5 text-left hover:border-black focus:outline-none focus:ring-2 focus:ring-black"
            >
              <div className="text-xs uppercase tracking-wide text-gray-500">Location</div>
              <div className="text-lg font-semibold">{loc.name}</div>
              <p className="text-sm text-gray-500 mt-1">
                Tutte le ricezioni, vendite e movimenti verranno registrati su questa sede.
              </p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
          <div>
            {loadingLocations ? "Aggiornamento location..." : "Non trovi la tua sede? Aggiungila nella pagina Locations."}
          </div>
          <div className="flex gap-2">
            <button onClick={refreshLocations} className="underline">
              Aggiorna elenco
            </button>
            {hasSelection && (
              <button onClick={closeSelector} className="px-4 py-2 rounded-lg bg-black text-white">
                Inizia
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
