import React, { createContext, useContext, useState, useEffect } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  user: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    // Verifica se l'utente è già autenticato
    const auth = localStorage.getItem("auth");
    if (auth) {
      const { username, isAuthenticated: authStatus } = JSON.parse(auth);
      setIsAuthenticated(authStatus);
      setUser(username);
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    // Credenziali fisse: admin / Sharkshopify1
    if (username === "admin" && password === "Sharkshopify1") {
      const authData = { username, isAuthenticated: true };
      localStorage.setItem("auth", JSON.stringify(authData));
      setIsAuthenticated(true);
      setUser(username);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem("auth");
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

