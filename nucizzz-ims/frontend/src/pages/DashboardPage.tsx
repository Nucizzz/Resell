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

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const menuItems = [
    {
      id: "products",
      icon: <Package className="h-5 w-5" />,
      title: "Prodotti",
      description: "Gestisci il catalogo prodotti e le informazioni",
      route: "/products",
      area: "md:[grid-area:1/1/2/7] xl:[grid-area:1/1/2/5]",
    },
    {
      id: "receive",
      icon: <Box className="h-5 w-5" />,
      title: "Ricezione Merce",
      description: "Aggiungi nuovi prodotti tramite scansione barcode",
      route: "/receive",
      area: "md:[grid-area:1/7/2/13] xl:[grid-area:1/5/2/9]",
    },
    {
      id: "addstock",
      icon: <PlusCircle className="h-5 w-5" />,
      title: "Aggiungi stock",
      description: "Carica rapidamente pezzi tramite barcode o ricerca",
      route: "/stock/add",
      area: "md:[grid-area:2/1/3/7] xl:[grid-area:1/9/2/13]",
    },
    {
      id: "sell",
      icon: <ShoppingCart className="h-5 w-5" />,
      title: "Vendita",
      description: "Registra vendite e aggiorna lo stock",
      route: "/sell",
      area: "md:[grid-area:2/7/3/13] xl:[grid-area:2/1/3/5]",
    },
    {
      id: "inventory",
      icon: <Warehouse className="h-5 w-5" />,
      title: "Inventario",
      description: "Visualizza lo stock per location e prodotto",
      route: "/inventory",
      area: "md:[grid-area:3/1/4/7] xl:[grid-area:2/5/3/9]",
    },
    {
      id: "transfers",
      icon: <ArrowRight className="h-5 w-5" />,
      title: "Trasferimenti",
      description: "Sposta prodotti tra warehouse e negozio",
      route: "/transfers",
      area: "md:[grid-area:3/7/4/13] xl:[grid-area:2/9/3/13]",
    },
    {
      id: "analytics",
      icon: <TrendingUp className="h-5 w-5" />,
      title: "Analytics",
      description: "Statistiche vendite e performance",
      route: "/analytics",
      area: "md:[grid-area:4/1/5/7] xl:[grid-area:3/1/4/5]",
    },
    {
      id: "sales",
      icon: <Search className="h-5 w-5" />,
      title: "Storico Vendite",
      description: "Visualizza lo storico delle vendite",
      route: "/sales",
      area: "md:[grid-area:4/7/5/13] xl:[grid-area:3/5/4/9]",
    },
    {
      id: "locations",
      icon: <Settings className="h-5 w-5" />,
      title: "Location",
      description: "Gestisci warehouse e negozi",
      route: "/locations",
      area: "md:[grid-area:5/1/6/13] xl:[grid-area:3/9/4/13]",
    },
  ];

  const filteredMenu = mode === "location"
    ? menuItems
    : menuItems.filter((item) => !["receive", "sell"].includes(item.id));

  const visibleCards = mode === "location"
    ? CARDS
    : CARDS.filter((card) => !["receive", "sell"].includes(card.id));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-white/60">Benvenuto</p>
            <h1 className="text-3xl font-bold">{user || "Operatore"}</h1>
            <p className="text-sm text-white/70">Gestisci tutto il negozio da un'unica dashboard.</p>
          </div>
          <div className="flex flex-col gap-3 text-sm">
            <div className="rounded-2xl border border-white/20 bg-white/5 p-3">
              <div className="text-xs uppercase text-white/60">Sede corrente</div>
              <div className="text-lg font-semibold">{locationLabel}</div>
              <div className="text-white/70">{modeHint}</div>
              <button className="btn mt-3 bg-white/20 text-white hover:bg-white/30" onClick={openSelector}>
                Cambia sede
              </button>
            </div>
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

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Azioni rapide</h2>
          <p className="text-sm text-gray-500">Ottimizzato per desktop e mobile</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
