import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api";

type Location = { id: number; name: string };
type Selection = { mode: "general" } | { mode: "location"; location: Location };

interface LocationContextValue {
  locations: Location[];
  refreshLocations: () => Promise<void>;
  mode: "general" | "location";
  location: Location | null;
  hasSelection: boolean;
  selectGeneral: () => void;
  selectLocation: (loc: Location) => void;
  clearSelection: () => void;
  openSelector: () => void;
  closeSelector: () => void;
  isSelectorOpen: boolean;
  loadingLocations: boolean;
}

const STORAGE_KEY = "nucizzz-location-selection";

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

const readInitialSelection = (): Selection | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.mode === "general") return { mode: "general" };
    if (parsed.mode === "location" && parsed.location?.id && parsed.location?.name) {
      return { mode: "location", location: parsed.location };
    }
  } catch (err) {
    console.warn("Impossibile leggere la location salvata:", err);
  }
  return null;
};

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selection, setSelection] = useState<Selection | null>(() => readInitialSelection());
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const persist = (value: Selection | null) => {
    if (typeof window === "undefined") return;
    if (!value) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    }
  };

  const refreshLocations = useCallback(async () => {
    setLoadingLocations(true);
    try {
      const res = await api.get("/locations/");
      const payload = Array.isArray(res.data) ? res.data : [];
      setLocations(payload);
      if (selection?.mode === "location") {
        const match = payload.find((l) => l.id === selection.location.id);
        if (!match) {
          setSelection(null);
          persist(null);
          setModalOpen(true);
        } else if (match.name !== selection.location.name) {
          const updated: Selection = { mode: "location", location: match };
          setSelection(updated);
          persist(updated);
        }
      }
    } catch (err) {
      console.error("Errore caricamento locations:", err);
    } finally {
      setLoadingLocations(false);
    }
  }, [selection]);

  useEffect(() => {
    refreshLocations();
  }, [refreshLocations]);

  useEffect(() => {
    if (!selection) {
      setModalOpen(true);
    }
  }, [selection]);

  const selectGeneral = () => {
    const sel: Selection = { mode: "general" };
    setSelection(sel);
    persist(sel);
    setModalOpen(false);
  };

  const selectLocation = (loc: Location) => {
    const sel: Selection = { mode: "location", location: loc };
    setSelection(sel);
    persist(sel);
    setModalOpen(false);
  };

  const clearSelection = () => {
    setSelection(null);
    persist(null);
    setModalOpen(true);
  };

  const openSelector = () => setModalOpen(true);
  const closeSelector = () => {
    if (selection) setModalOpen(false);
  };

  const mode = selection?.mode ?? "general";
  const location = selection?.mode === "location" ? selection.location : null;
  const hasSelection = Boolean(selection);
  const isSelectorOpen = modalOpen || !selection;

  return (
    <LocationContext.Provider
      value={{
        locations,
        refreshLocations,
        mode,
        location,
        hasSelection,
        selectGeneral,
        selectLocation,
        clearSelection,
        openSelector,
        closeSelector,
        isSelectorOpen,
        loadingLocations,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationSelection() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocationSelection deve essere usato dentro LocationProvider");
  return ctx;
}
