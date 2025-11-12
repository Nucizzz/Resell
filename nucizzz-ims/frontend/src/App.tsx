// frontend/src/App.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Topbar from "./components/Topbar";
import ProductsPage from "./pages/ProductsPage";
import ReceivePage from "./pages/ReceivePage";
import SellPage from "./pages/SellPage";
import SetupPage from "./pages/SetupPage";

export default function App() {
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <Topbar />
      <Routes>
        <Route path="/" element={<Navigate to="/products" replace />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/receive" element={<ReceivePage />} />
        <Route path="/sell" element={<SellPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="*" element={<Navigate to="/products" replace />} />
      </Routes>
    </div>
  );
}
