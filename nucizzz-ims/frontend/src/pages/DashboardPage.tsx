import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Box,
  LogOut,
  Package,
  PlusCircle,
  Search,
  Settings,
  ShoppingCart,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useLocationSelection } from "../contexts/LocationContext";

type ActionCard = {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  route: string;
};

const CARDS: ActionCard[] = [
  { id: "products", icon: <Package className="h-5 w-5" />, title: "Prodotti", description: "Gestisci catalogo e varianti", route: "/products" },
  { id: "receive", icon: <Box className="h-5 w-5" />, title: "Ricezione", description: "Registra nuovi arrivi", route: "/receive" },
  { id: "addstock", icon: <PlusCircle className="h-5 w-5" />, title: "Aggiungi stock", description: "Carica pezzi rapidamente", route: "/stock/add" },
  { id: "sell", icon: <ShoppingCart className="h-5 w-5" />, title: "Vendita", description: "Vendi e scala la giacenza", route: "/sell" },
  { id: "inventory", icon: <Warehouse className="h-5 w-5" />, title: "Inventario", description: "Consulta stock per sede", route: "/inventory" },
  { id: "transfers", icon: <ArrowRight className="h-5 w-5" />, title: "Trasferimenti", description: "Sposta tra location", route: "/transfers" },
  { id: "analytics", icon: <TrendingUp className="h-5 w-5" />, title: "Analytics", description: "Metriche e andamenti", route: "/analytics" },
  { id: "sales", icon: <Search className="h-5 w-5" />, title: "Storico vendite", description: "Filtri e export Excel", route: "/sales" },
  { id: "locations", icon: <Settings className="h-5 w-5" />, title: "Sedi", description: "Configura punti vendita", route: "/locations" },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { mode, location, openSelector } = useLocationSelection();

  const locationLabel = mode === "location" ? location?.name || "Location" : "Vista generale";
  const modeHint = mode === "location"
    ? "Le azioni stock agiscono sulla sede selezionata"
    : "Modalità consultazione: aggiorna prodotti senza muovere stock";

  const visibleCards = mode === "location" ? CARDS : CARDS.filter((card) => !["receive", "sell"].includes(card.id));

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <section className="rounded-3xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm uppercase tracking-widest text-white/60">Benvenuto</p>
              <h1 className="text-3xl font-bold">{user || "Operatore"}</h1>
              <p className="text-sm text-white/70">Gestisci il negozio in modo centralizzato da desktop e mobile.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs uppercase text-white/60">Modalità</p>
                <p className="text-lg font-semibold">{mode === "location" ? "Operativa" : "Consultazione"}</p>
                <p className="text-sm text-white/70">{modeHint}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs uppercase text-white/60">Sede attiva</p>
                <p className="text-lg font-semibold">{locationLabel}</p>
                <p className="text-sm text-white/70">Aggiorna movimenti e vendite qui</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs uppercase text-white/60">Ultimo accesso</p>
                <p className="text-lg font-semibold">{new Date().toLocaleDateString()}</p>
                <p className="text-sm text-white/70">Solo indicativo lato client</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="btn bg-white/20 text-white hover:bg-white/30" onClick={openSelector}>
                Cambia sede
              </button>
              <button
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="btn bg-red-500/20 text-white hover:bg-red-500/40"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </section>

        <aside className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="space-y-3">
            <p className="text-xs uppercase text-gray-500">Sede corrente</p>
            <h2 className="text-2xl font-semibold">{locationLabel}</h2>
            <p className="text-sm text-gray-500">{modeHint}</p>
            <button className="btn w-full" onClick={openSelector}>
              Cambia rapidamente
            </button>
          </div>
          <div className="mt-6 border-t pt-4 text-sm text-gray-600 space-y-2">
            <p>Controlla ricezioni, vendite e trasferimenti senza uscire dalla pagina.</p>
            <p className="font-semibold text-gray-900">Hai accesso a {visibleCards.length} flussi rapidi.</p>
          </div>
        </aside>
      </div>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Azioni rapide</h2>
            <p className="text-sm text-gray-500">Scegli il flusso operativo da avviare</p>
          </div>
          <p className="text-xs uppercase text-gray-400">Desktop ready</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleCards.map((card) => (
            <button
              key={card.id}
              onClick={() => navigate(card.route)}
              className="rounded-2xl border border-gray-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gray-100 p-3 text-gray-900">{card.icon}</div>
                <div>
                  <div className="text-base font-semibold">{card.title}</div>
                  <p className="text-sm text-gray-500">{card.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
