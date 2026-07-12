import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes/AppRoutes";
import { useAuthStore } from "./store/authStore";
import { authApi } from "./services/auth";
import { ToastContainer } from "./components/ui/Toast";

/**
 * App — root component.
 *
 * Auth bootstrap: Zustand's `persist` middleware restores `token`/`user` from
 * localStorage synchronously on load, but we still need to VALIDATE that token
 * against the backend (it may have expired — ACCESS_TOKEN_EXPIRE_MINUTES=1440
 * per README, so a token from yesterday is dead weight). This effect:
 *
 *   1. If no token exists at all → not authenticated, stop loading immediately.
 *   2. If a token exists → call GET /api/auth/me to confirm it's still valid
 *      and refresh the user profile (role/active-status may have changed
 *      server-side since last login).
 *   3. On failure (401 etc.) → the axios interceptor in services/api.js already
 *      clears the session and redirects; we just also flip isLoading off here
 *      as a safety net in case that redirect races with this component.
 *
 * ProtectedRoute reads `isLoading` to show a branded spinner instead of a
 * flash of the login screen while this check is in flight.
 */
export default function App() {
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) {
          setUser(me);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          clearSession();
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
    // Intentionally only runs once on mount — token changes after this point
    // (login/logout) are handled directly by their respective flows, not by re-running bootstrap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BrowserRouter>
      <AppRoutes />
      <ToastContainer />
    </BrowserRouter>
  );
}