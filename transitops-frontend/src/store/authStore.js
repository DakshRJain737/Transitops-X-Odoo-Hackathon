import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { hasPermission } from "../constants/roles";

/**
 * useAuthStore — single source of truth for the authenticated user + JWT token.
 *
 * Backend flow this supports (see README §Authentication & Roles):
 *   1. POST /api/auth/login  → returns { access_token }
 *   2. GET  /api/auth/me     → returns user profile (id, email, full_name, role, ...)
 *   3. Every subsequent request sends `Authorization: Bearer <token>`
 *
 * Persisted to localStorage under "transitops-auth" so refreshing the page
 * doesn't log the user out. Only `token` and `user` are persisted — nothing
 * derived (isLoading etc.) leaks into storage.
 */
export const useAuthStore = create()(
  persist(
    (set, get) => ({
      // ---- state ----
      user: null, // { id, email, full_name, role, is_active, ... } from GET /api/auth/me
      token: null, // raw JWT string, sent as Authorization: Bearer <token>
      isLoading: true, // true until initial auth check (token validation) resolves

      // ---- actions ----

      /** Called after a successful login + /me fetch. Single entry point for "user is now logged in". */
      setSession: ({ user, token }) =>
        set({ user, token, isLoading: false }),

      /** Updates just the user profile (e.g. after PATCH /api/auth/me or admin edits self) */
      setUser: (user) => set({ user }),

      /** Called on logout, 401 response, or expired token detection */
      clearSession: () => set({ user: null, token: null, isLoading: false }),

      setLoading: (isLoading) => set({ isLoading }),

      // ---- derived helpers (selectors) ----

      isAuthenticated: () => Boolean(get().token && get().user),

      /** e.g. useAuthStore.getState().hasRole("admin") */
      hasRole: (...roles) => roles.includes(get().user?.role),

      /** e.g. useAuthStore.getState().can("createVehicle") — wraps ROLE_ROUTE_ACCESS from constants/roles.js */
      can: (actionKey) => {
        const role = get().user?.role;
        if (!role) return false;
        return hasPermission(role, actionKey);
      },
    }),
    {
      name: "transitops-auth", // localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);

export const getAuthState = () => useAuthStore.getState();