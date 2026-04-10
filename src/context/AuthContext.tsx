import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  user: { name: string; level: string } | null;
  login: (name: string, level: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ name: string; level: string } | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('auth_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      setIsAuthenticated(true);
      setUser(parsed);
    }
  }, []);

  const login = (name: string, level: string) => {
    const userData = { name, level };
    setIsAuthenticated(true);
    setUser(userData);
    sessionStorage.setItem('auth_session', JSON.stringify(userData));
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    sessionStorage.removeItem('auth_session');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
