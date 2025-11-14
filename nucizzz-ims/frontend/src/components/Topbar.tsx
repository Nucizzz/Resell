// frontend/src/components/Topbar.tsx
import React, { useContext } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../api";
import { ToastContext } from "../App";

const linkBase = "px-3 py-2 rounded-lg";
const active = "bg-black text-white";
const idle = "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600";

export default function Topbar() {
  const [open, setOpen] = React.useState(false);
  const [dark, setDark] = React.useState(false);
  const toast = useContext(ToastContext);

  React.useEffect(() => {
    const v = localStorage.getItem("theme") === "dark";
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
  }, []);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Nucizzz IMS</h1>
          <div className="hidden md:flex items-center gap-2 text-sm">
            <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">Tot: {total ?? "-"}</span>
            <span className="px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">Low: {lowStock ?? "-"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
        <NavLink to="/sell" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Vendita</NavLink>
        <NavLink to="/inventory" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Inventario</NavLink>
        <NavLink to="/sales" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Storico</NavLink>
        <NavLink to="/analytics" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Analisi</NavLink>
        <NavLink to="/setup" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Setup</NavLink>
      </nav>
      {open && (
        <div className="md:hidden mt-2 grid grid-cols-2 gap-2">
          <button className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-700" onClick={toggleTheme}>{dark ? "Light" : "Dark"}</button>
          <NavLink to="/products" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Prodotti</NavLink>
          <NavLink to="/receive" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Ricezione</NavLink>
          <NavLink to="/sell" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Vendita</NavLink>
          <NavLink to="/inventory" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Inventario</NavLink>
          <NavLink to="/sales" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Storico</NavLink>
          <NavLink to="/analytics" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Analisi</NavLink>
          <NavLink to="/setup" className={({ isActive }) => `${linkBase} ${isActive ? active : idle}`}>Setup</NavLink>
        </div>
      )}
    </div>
  );
}
