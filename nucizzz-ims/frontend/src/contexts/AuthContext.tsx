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

const CREDENTIALS: Record<string, string> = {
  admin: "Sharkshopify1",
  milo: "Treviso",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialAuth = getStoredAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuth.isAuthenticated);
  const [user, setUser] = useState<string | null>(initialAuth.user);

  const login = async (username: string, password: string): Promise<boolean> => {
    const normalizedUser = username.trim().toLowerCase();
    const expectedPassword = CREDENTIALS[normalizedUser];
    if (expectedPassword && password === expectedPassword) {
      const canonicalUsername = normalizedUser;
      const authData = { username: canonicalUsername, isAuthenticated: true };
      localStorage.setItem("auth", JSON.stringify(authData));
      setIsAuthenticated(true);
      setUser(canonicalUsername);
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

