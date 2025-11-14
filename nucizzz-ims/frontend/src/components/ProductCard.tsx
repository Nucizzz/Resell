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
  brand?: string;
  sku?: string;
  is_active?: boolean;
};

type Props = {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onSell: () => void;
};

export default function ProductCard({ product, onEdit, onDelete, onSell }: Props) {
  const low = (product.stock ?? 0) < 5;
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex gap-3">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title}
            className="w-24 h-24 object-cover rounded-xl"
          />
        ) : (
          <div className="w-24 h-24 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs">No img</div>
        )}
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold text-lg">{product.title}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">{product.brand} • {product.size}</div>
              <div className="text-sm text-gray-500">SKU {product.sku} {product.barcode ? `• ${product.barcode}` : ""}</div>
            </div>
            <div className={`px-2 py-1 rounded-full text-xs ${low ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200" : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"}`}>
              Stock {product.stock ?? 0}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-xs">€{product.price_eur ?? "-"}</span>
            {product.is_active === false && <span className="px-2 py-1 rounded bg-gray-300 dark:bg-gray-700 text-xs">Disattivato</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onEdit} className="btn flex-1">Modifica</button>
        <button onClick={onSell} className="btn bg-blue-600 text-white flex-1">Vendi</button>
        <button onClick={onDelete} className="btn bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">Elimina</button>
      </div>
    </div>
  );
}