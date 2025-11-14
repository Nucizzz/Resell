import React from "react";
import { NavLink } from "react-router-dom";

const link = "flex flex-col items-center gap-1 text-xs px-2 py-2 rounded-lg";
const active = "bg-black text-white";
const idle = "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-t border-gray-200 dark:border-gray-700 flex justify-around z-30">
      <NavLink to="/products" className={({ isActive }) => `${link} ${isActive ? active : idle}`}>
        <span>📦</span>
        <span>Prodotti</span>
      </NavLink>
      <NavLink to="/receive" className={({ isActive }) => `${link} ${isActive ? active : idle}`}>
        <span>⬇️</span>
        <span>Ricevi</span>
      </NavLink>
      <NavLink to="/sell" className={({ isActive }) => `${link} ${isActive ? active : idle}`}>
        <span>⬆️</span>
        <span>Vendi</span>
      </NavLink>
      <NavLink to="/inventory" className={({ isActive }) => `${link} ${isActive ? active : idle}`}>
        <span>📊</span>
        <span>Stock</span>
      </NavLink>
      <NavLink to="/analytics" className={({ isActive }) => `${link} ${isActive ? active : idle}`}>
        <span>📈</span>
        <span>Analisi</span>
      </NavLink>
    </nav>
  );
}