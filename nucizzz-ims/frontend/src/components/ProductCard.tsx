// frontend/src/components/ProductCard.tsx
import React from "react";

export type Product = {
  id: number;
  barcode: string;
  title: string;
  size?: string;
  price_eur?: number;
  description?: string;
  weight_g?: number;
  package_required?: string;
  cost_eur?: number;
  location?: string;
  image_url?: string;
  stock?: number;
  created_at?: string;
};

export default function ProductCard({ p }: { p: Product }) {
  return (
    <div className="card flex gap-4 items-start">
      <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-xs text-gray-400">
            No image
          </div>
        )}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex gap-2 items-center">
          <h3 className="font-semibold">{p.title || "Senza titolo"}</h3>
          {p.size && (
            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
              {p.size}
            </span>
          )}
          {p.location && (
            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
              {p.location}
            </span>
          )}
        </div>
        <div className="text-sm text-gray-600">EAN/SKU: {p.barcode}</div>
        {p.description && (
          <div className="text-sm text-gray-700">{p.description}</div>
        )}
        <div className="text-sm">
          Prezzo: {p.price_eur ? `€ ${p.price_eur.toFixed(2)}` : "—"} ·
          &nbsp;Costo: {p.cost_eur ? `€ ${p.cost_eur.toFixed(2)}` : "—"} ·
          &nbsp;Stock: {p.stock ?? "—"}
        </div>
      </div>
    </div>
  );
}
