// frontend/src/App.tsx
import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Topbar from "./components/Topbar";
import BottomNav from "./components/BottomNav";
import Toaster from "./components/Toaster";
import { useToast } from "./hooks/useToast";
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

export const ToastContext = React.createContext<ReturnType<typeof useToast>>({} as any);

// Componente per proteggere le route
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function AppContent() {
  const toast = useToast();
  const { isAuthenticated } = useAuth();
  
  // Se non autenticato, reindirizza sempre al login
  useEffect(() => {
    if (!isAuthenticated && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }, [isAuthenticated]);
  
  return (
    <ToastContext.Provider value={toast}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Navigate to="/dashboard" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 space-y-4 pb-24">
                <Topbar />
                <ProductsPage />
              </div>
              <BottomNav />
            </ProtectedRoute>
          }
        />
        <Route
          path="/receive"
          element={
            <ProtectedRoute>
              <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 space-y-4 pb-24">
                <Topbar />
                <ReceivePage />
              </div>
              <BottomNav />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sell"
          element={
            <ProtectedRoute>
              <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 space-y-4 pb-24">
                <Topbar />
                <SellPage />
              </div>
              <BottomNav />
            </ProtectedRoute>
          }
        />
        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 space-y-4 pb-24">
                <Topbar />
                <SetupPage />
              </div>
              <BottomNav />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/new"
          element={
            <ProtectedRoute>
              <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 space-y-4 pb-24">
                <Topbar />
                <ProductFormPage />
              </div>
              <BottomNav />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/edit/:id"
          element={
            <ProtectedRoute>
              <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 space-y-4 pb-24">
                <Topbar />
                <ProductFormPage />
              </div>
              <BottomNav />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transfers"
          element={
            <ProtectedRoute>
              <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 space-y-4 pb-24">
                <Topbar />
                <TransfersPage />
              </div>
              <BottomNav />
            </ProtectedRoute>
          }
        />
        <Route
          path="/locations"
          element={
            <ProtectedRoute>
              <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 space-y-4 pb-24">
                <Topbar />
                <LocationsPage />
              </div>
              <BottomNav />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 space-y-4 pb-24">
                <Topbar />
                <InventoryPage />
              </div>
              <BottomNav />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales"
          element={
            <ProtectedRoute>
              <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 space-y-4 pb-24">
                <Topbar />
                <SalesHistoryPage />
              </div>
              <BottomNav />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 space-y-4 pb-24">
                <Topbar />
                <AnalyticsPage />
              </div>
              <BottomNav />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster toasts={toast.toasts} />
    </ToastContext.Provider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
