// frontend/src/components/Topbar.tsx
import React from "react";
import { NavLink } from "react-router-dom";

const linkBase = "px-3 py-2 rounded-lg";
const active = "bg-black text-white";
const idle = "bg-gray-100 hover:bg-gray-200";

export default function Topbar() {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">Nucizzz IMS</h1>
      <nav className="flex gap-2">
        <NavLink
          to="/products"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? active : idle}`
          }
        >
          Prodotti
        </NavLink>
        <NavLink
          to="/receive"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? active : idle}`
          }
        >
          Ricezione
        </NavLink>
        <NavLink
          to="/sell"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? active : idle}`
          }
        >
          Vendita
        </NavLink>
        <NavLink
          to="/setup"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? active : idle}`
          }
        >
          Setup
        </NavLink>
      </nav>
    </div>
  );
}
