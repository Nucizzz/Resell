import React from "react";
import { Toast } from "../hooks/useToast";

export default function Toaster({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2 rounded-lg shadow text-sm ${
            t.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}