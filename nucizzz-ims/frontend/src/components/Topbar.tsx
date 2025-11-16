// frontend/src/components/Topbar.tsx
import React, { useContext } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { api } from "../api";
import { ToastContext } from "../App";
import { useLocationSelection } from "../contexts/LocationContext";

const linkBase = "px-3 py-2 rounded-lg";
const active = "bg-black text-white";
const idle = "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600";

export default function Topbar() {
  const [open, setOpen] = React.useState(false);
  const [dark, setDark] = React.useState(false);
  const toast = useContext(ToastContext);
  const { mode, location, openSelector } = useLocationSelection();
  const route = useLocation();

  const currentLabel = mode === "location" ? location?.name || "Location" : "Vista generale";
  const modeDescription = mode === "location" ? "Movimenti su questa sede" : "Solo consultazione";

  React.useEffect(() => {
    const v = localStorage.getItem("theme") === "dark";
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
  }, []);

  React.useEffect(() => {
    if (open) setOpen(false);
  }, [route.pathname]);
  function toggleTheme() {
    const v = !dark;
    setDark(v);
    localStorage.setItem("theme", v ? "dark" : "light");
    document.documentElement.classList.toggle("dark", v);
  }

  // KPI badge
  const [total, setTotal] = React.useState<number | null>(null);
  const [lowStock, setLowStock] = React.useState<number | null>(null);
  React.useEffect(() => {
    (async () => {
      try {
        const p = await api.get("/products/", { params: { limit: 1 } });
        const list = Array.isArray(p.data) ? p.data : [];
        setTotal(list.length ? (p.data.total ?? list.length) : 0);
      } catch {}
      try {
        const l = await api.get("/stock/low");
        const list = Array.isArray(l.data) ? l.data : [];
        setLowStock(list.length);
      } catch {}
    })();
  }, []);

  return (
    <div className="sticky top-0 z-20 backdrop-blur bg-white/70 dark:bg-gray-900/70 py-2 px-2 rounded-xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Nucizzz IMS</h1>
          <div className="hidden md:flex items-center gap-2 text-sm">
            <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">Tot: {total ?? "-"}</span>
            <span className="px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">Low: {lowStock ?? "-"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex flex-col text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-base text-gray-900 dark:text-gray-100">{currentLabel}</span>
            <span>{modeDescription}</span>
          </div>
          <button className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-700" onClick={openSelector}>
            Cambia sede
          </button>
          <button className="hidden md:block px-3 py-2 rounded bg-gray-100 dark:bg-gray-700" onClick={toggleTheme}>
            {dark ? "Light" : "Dark"}
          </button>
          <button className="md:hidden px-3 py-2 rounded bg-gray-100 dark:bg-gray-700" onClick={() => setOpen((o) => !o)}>
            Menu
          </button>
        </div>
      </div>
      <nav className="hidden md:flex gap-2 mt-2">
        <NavLink to="/products" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Prodotti</NavLink>
        <NavLink to="/receive" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Ricezione</NavLink>
        <NavLink to="/stock/add" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Aggiungi stock</NavLink>
        <NavLink to="/sell" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Vendita</NavLink>
        <NavLink to="/inventory" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Inventario</NavLink>
        <NavLink to="/sales" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Storico</NavLink>
        <NavLink to="/analytics" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Analisi</NavLink>
        <NavLink to="/setup" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Setup</NavLink>
      </nav>
      {open && (
        <div className="md:hidden mt-2 grid grid-cols-2 gap-2">
          <div className="col-span-2 flex flex-col rounded-lg bg-gray-100 dark:bg-gray-800 p-3 text-sm">
            <span className="font-semibold text-base text-gray-900 dark:text-gray-100">{currentLabel}</span>
            <span className="text-gray-500 dark:text-gray-400">{modeDescription}</span>
            <button className="btn mt-2" onClick={openSelector}>Cambia</button>
          </div>
          <button className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-700" onClick={toggleTheme}>{dark ? "Light" : "Dark"}</button>
          <NavLink onClick={() => setOpen(false)} to="/products" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>
            Prodotti
          </NavLink>
          <NavLink onClick={() => setOpen(false)} to="/receive" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>
            Ricezione
          </NavLink>
          <NavLink onClick={() => setOpen(false)} to="/stock/add" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>
            Aggiungi stock
          </NavLink>
          <NavLink onClick={() => setOpen(false)} to="/sell" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>
            Vendita
          </NavLink>
          <NavLink onClick={() => setOpen(false)} to="/inventory" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>
            Inventario
          </NavLink>
          <NavLink onClick={() => setOpen(false)} to="/sales" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>
            Storico
          </NavLink>
          <NavLink onClick={() => setOpen(false)} to="/analytics" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>
            Analisi
          </NavLink>
          <NavLink onClick={() => setOpen(false)} to="/setup" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>
            Setup
          </NavLink>
        </div>
      )}
    </div>
  );
}
