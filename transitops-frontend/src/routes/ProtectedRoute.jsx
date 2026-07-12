import { Navigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { useAuthStore } from "../store/authStore";

/**
 * ProtectedRoute — wraps every authenticated route (see AppRoutes.jsx).
 *
 * Handles three explicit states so the UI never flashes wrong/blank content:
 *  1. isLoading   → initial token validation still in flight (e.g. app just
 *                    booted and we're calling GET /api/auth/me) → branded spinner
 *  2. !isAuthenticated → bounce to /login, remembering the attempted path via
 *                    location state so login can redirect back afterward
 *  3. allowedRoles set but user's role isn't included → bounce to /dashboard
 *                    (used sparingly — most pages are role-filtered via the
 *                    Sidebar nav itself, this is a hard backstop for direct URL access)
 */
export function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const role = useAuthStore((s) => s.user?.role);

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

/** Branded full-screen loader shown only during the initial auth check on app boot */
function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-base-black flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-glow-md animate-pulse-glow">
          <Zap className="w-6 h-6 text-white" strokeWidth={2.5} />
        </div>
        <div className="w-32 h-1 rounded-full bg-surface-700 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-accent-400 to-accent-600"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </div>
  );
}

export default ProtectedRoute;