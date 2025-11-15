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
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { cn } from "@/lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { useLocationSelection } from "../contexts/LocationContext";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { mode, location, openSelector } = useLocationSelection();

  const locationLabel = mode === "location" ? location?.name || "Location" : "Vista generale";
  const modeHint = mode === "location"
    ? "Tutte le ricezioni e vendite agiscono su questa sede"
    : "Modalità consultazione: puoi vedere stock e creare prodotti";

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Dashboard
            </h1>
            <p className="text-gray-400 mt-1">
              Benvenuto, {user || "Utente"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/50 transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white space-y-2">
          <div className="text-sm uppercase text-white/70">Sede corrente</div>
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div>
              <p className="text-2xl font-semibold">{locationLabel}</p>
              <p className="text-white/70 text-sm">{modeHint}</p>
            </div>
            <button onClick={openSelector} className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30">
              Cambia sede
            </button>
          </div>
        </div>

        {/* Menu Grid */}
        <ul className="grid grid-cols-1 grid-rows-none gap-4 md:grid-cols-12 md:grid-rows-5 lg:gap-4 xl:max-h-[34rem] xl:grid-rows-3">
          {filteredMenu.map((item) => (
            <GridItem
              key={item.id}
              area={item.area}
              icon={item.icon}
              title={item.title}
              description={item.description}
              route={item.route}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

interface GridItemProps {
  area: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  route: string;
}

const GridItem = ({ area, icon, title, description, route }: GridItemProps) => {
  const navigate = useNavigate();

  return (
    <li className={cn("min-h-[14rem] list-none", area)}>
      <div 
        className="relative h-full rounded-[1.25rem] border-[0.75px] border-border p-2 md:rounded-[1.5rem] md:p-3 cursor-pointer group"
        onClick={() => navigate(route)}
      >
        <GlowingEffect
          spread={40}
          glow={true}
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
          borderWidth={3}
        />
        <div className="relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-xl border-[0.75px] bg-background p-6 shadow-sm dark:shadow-[0px_0px_27px_0px_rgba(45,45,45,0.3)] md:p-6 transition-transform group-hover:scale-[1.02]">
          <div className="relative flex flex-1 flex-col justify-between gap-3">
            <div className="w-fit rounded-lg border-[0.75px] border-border bg-muted p-2 text-foreground">
              {icon}
            </div>
            <div className="space-y-3">
              <h3 className="pt-0.5 text-xl leading-[1.375rem] font-semibold font-sans tracking-[-0.04em] md:text-2xl md:leading-[1.875rem] text-balance text-foreground">
                {title}
              </h3>
              <h2 className="[&_b]:md:font-semibold [&_strong]:md:font-semibold font-sans text-sm leading-[1.125rem] md:text-base md:leading-[1.375rem] text-muted-foreground">
                {description}
              </h2>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
};

