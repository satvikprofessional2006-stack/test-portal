// Zustand auth store — persists to localStorage

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: "student" | "admin" | "proctor";
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: AuthUser, access: string, refresh: string) => void;
  clearAuth: () => void;
  isAdmin: () => boolean;
  isStudent: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) => {
        // Also set in localStorage for the axios interceptor
        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", accessToken);
          localStorage.setItem("refresh_token", refreshToken);
        }
        set({ user, accessToken, refreshToken });
      },
      clearAuth: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
        set({ user: null, accessToken: null, refreshToken: null });
      },
      isAdmin: () => get().user?.role === "admin",
      isStudent: () => get().user?.role === "student",
    }),
    {
      name: "exam-portal-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
