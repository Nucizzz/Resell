// frontend/src/App.tsx
import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LocationProvider } from "./contexts/LocationContext";
import Topbar from "./components/Topbar";
import BottomNav from "./components/BottomNav";
import Toaster from "./components/Toaster";
import { useToast } from "./hooks/useToast";
import LocationSelector from "./components/LocationSelector";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import ReceivePage from "./pages/ReceivePage";
import SetupPage from "./pages/SetupPage";
import ProductFormPage from "./pages/ProductFormPage";
import SellPage from "./pages/SellPage";
import TransfersPage from "./pages/TransfersPage";
import LocationsPage from "./pages/LocationsPage";
import InventoryPage from "./pages/InventoryPage";
import SalesHistoryPage from "./pages/SalesHistoryPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AddStockPage from "./pages/AddStockPage";

export const ToastContext = React.createContext<ReturnType<typeof useToast>>({} as any);

// Componente per proteggere le route
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function ShellLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 pb-28 space-y-4">
        <Topbar />
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}

function AppContent() {
  const toast = useToast();
  return (
    <ToastContext.Provider value={toast}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <ShellLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/receive" element={<ReceivePage />} />
          <Route path="/stock/add" element={<AddStockPage />} />
          <Route path="/sell" element={<SellPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/products/new" element={<ProductFormPage />} />
          <Route path="/products/edit/:id" element={<ProductFormPage />} />
          <Route path="/transfers" element={<TransfersPage />} />
          <Route path="/locations" element={<LocationsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/sales" element={<SalesHistoryPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster toasts={toast.toasts} />
      <LocationSelector />
    </ToastContext.Provider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <AppContent />
      </LocationProvider>
    </AuthProvider>
  );
}
