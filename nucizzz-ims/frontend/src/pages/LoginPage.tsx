import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Lock, User } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const success = await login(username, password);
      if (success) {
        navigate("/dashboard");
      } else {
        setError("Credenziali non valide");
      }
    } catch (err) {
      setError("Errore durante il login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="card bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <div className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-white">Nucizzz IMS</h1>
              <p className="text-gray-300">Accedi al tuo account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input w-full bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-white/40 focus:ring-2 focus:ring-white/20"
                  placeholder="Inserisci username"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input w-full bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-white/40 focus:ring-2 focus:ring-white/20"
                  placeholder="Inserisci password"
                  required
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn w-full bg-white text-gray-900 hover:bg-gray-100 font-semibold py-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? "Accesso in corso..." : "Accedi"}
              </button>
            </form>

            <div className="text-center text-xs text-gray-400">
              Sistema di gestione inventario
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

