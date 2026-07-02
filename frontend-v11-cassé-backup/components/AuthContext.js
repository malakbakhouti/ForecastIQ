"use client";

// components/AuthContext.js — État d'authentification global

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, saveAuth, clearAuth, getStoredUser, getToken } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = getStoredUser();
    const token = getToken();
    if (stored && token) {
      setUser(stored);
      api
        .me()
        .then((data) => setUser(data.user))
        .catch(() => {
          clearAuth();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email, password) {
    const data = await api.login(email, password);
    saveAuth(data.token, data.user);
    setUser(data.user);
    return data.user;
  }

  async function register(email, password, fullName) {
    const data = await api.register(email, password, fullName);
    saveAuth(data.token, data.user);
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    clearAuth();
    setUser(null);
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return ctx;
}
