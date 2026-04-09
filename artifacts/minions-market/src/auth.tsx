import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export interface User {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
  balance?: number;
  frozenBalance?: number;
  totalSales?: number;
  totalPurchases?: number;
  rating?: number;
  reviewCount?: number;
  isAdmin?: boolean;
  isVerified?: boolean;
  isBanned?: boolean;
  banReason?: string | null;
  banAt?: number | null;
  banUntil?: number | null;
  sellerLevel?: string;
  telegramId?: string;
  refCode?: string;
  createdAt?: number;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  updateUser: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isTelegramMiniApp: boolean;
  isTelegramLoading: boolean;
  setTelegramLoading: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function detectTelegramMiniApp(): boolean {
  try {
    const tg = (window as any).Telegram?.WebApp;
    return !!(tg?.initData && tg.initData.length > 0);
  } catch {
    return false;
  }
}

function getTelegramIdFromInitData(): string | null {
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.initData) return null;
    const params = new URLSearchParams(tg.initData);
    const userStr = params.get("user");
    if (!userStr) return null;
    const tgUser = JSON.parse(decodeURIComponent(userStr));
    return tgUser?.id ? String(tgUser.id) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const currentTgId = getTelegramIdFromInitData();
    if (currentTgId) {
      try {
        const storedUser = localStorage.getItem("mm_user");
        const parsed = storedUser ? JSON.parse(storedUser) : null;
        if (parsed?.telegramId && parsed.telegramId !== currentTgId) {
          localStorage.removeItem("mm_token");
          localStorage.removeItem("mm_user");
          return null;
        }
      } catch {}
    }
    return localStorage.getItem("mm_token");
  });

  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem("mm_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isTelegramMiniApp] = useState(detectTelegramMiniApp);
  const [isTelegramLoading, setIsTelegramLoading] = useState(detectTelegramMiniApp);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isTelegramLoading) return;
    const timeout = setTimeout(() => setIsTelegramLoading(false), 5000);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAuth = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("mm_token", newToken);
    localStorage.setItem("mm_user", JSON.stringify(newUser));
  }, []);

  const updateUser = useCallback((newUser: User) => {
    setUser(newUser);
    localStorage.setItem("mm_user", JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("mm_token");
    localStorage.removeItem("mm_user");
  }, []);

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("mm_token"));
  }, []);

  // Периодически обновляем данные пользователя с сервера
  // Это гарантирует, что isAdmin, isBanned и др. всегда актуальны
  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem("mm_token");
    if (!t) return;
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const fresh = await res.json();
        setUser(fresh);
        localStorage.setItem("mm_user", JSON.stringify(fresh));
      } else if (res.status === 401) {
        // Токен истёк
        logout();
      }
    } catch {}
  }, [logout]);

  useEffect(() => {
    if (!token) return;
    // Обновляем сразу при авторизации
    refreshUser();
    // И каждые 60 секунд
    refreshIntervalRef.current = setInterval(refreshUser, 60_000);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [token, refreshUser]);

  return (
    <AuthContext.Provider value={{
      token,
      user,
      setAuth,
      updateUser,
      logout,
      isAuthenticated: !!token,
      isTelegramMiniApp,
      isTelegramLoading,
      setTelegramLoading: setIsTelegramLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
