import React, { createContext, useContext, useState } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  user: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getStoredAuth = () => {
  if (typeof window === "undefined") {
    return { isAuthenticated: false, user: null as string | null };
  }
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return { isAuthenticated: false, user: null as string | null };
    const parsed = JSON.parse(raw);
    return {
      isAuthenticated: Boolean(parsed?.isAuthenticated),
      user: typeof parsed?.username === "string" ? parsed.username : null,
    };
  } catch {
    return { isAuthenticated: false, user: null as string | null };
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialAuth = getStoredAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuth.isAuthenticated);
  const [user, setUser] = useState<string | null>(initialAuth.user);

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

