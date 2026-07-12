import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AppLayout } from "../layouts/AppLayout";
import { AuthLayout } from "../layouts/AuthLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { ROLES } from "../constants/roles";

/**
 * Every page is lazy-loaded from its EVENTUAL file path. This means routing
 * is fully wired right now — as soon as a page file is saved at the path
 * referenced below, it becomes reachable with zero changes to this file.
 * Until then, visiting that route shows the Suspense fallback (never a crash,
 * Vite just won't have resolved the module yet during dev if the file is missing —
 * pages must exist before their route is visited).
 */
const Login = lazy(() => import("../pages/auth/Login"));
const Dashboard = lazy(() => import("../pages/dashboard/Dashboard"));
const VehiclesList = lazy(() => import("../pages/vehicles/VehiclesList"));
const VehicleDetails = lazy(() => import("../pages/vehicles/VehicleDetails"));
const DriversList = lazy(() => import("../pages/drivers/DriversList"));
const DriverDetails = lazy(() => import("../pages/drivers/DriverDetails"));
const TripDispatch = lazy(() => import("../pages/trips/TripDispatch"));
const TripDetails = lazy(() => import("../pages/trips/TripDetails"));
const Maintenance = lazy(() => import("../pages/maintenance/Maintenance"));
const FuelExpense = lazy(() => import("../pages/fuel-expense/FuelExpense"));
const Reports = lazy(() => import("../pages/reports/Reports"));
const Settings = lazy(() => import("../pages/settings/Settings"));
const NotFound = lazy(() => import("../pages/NotFound"));

/** Simple centered fallback for lazy-loaded route chunks (network-speed loading, not auth loading) */
function RouteFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <motion.div
        className="w-8 h-8 rounded-full border-2 border-accent-500/30 border-t-accent-500"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* ---- Public ---- */}
        <Route
          path="/login"
          element={
            <AuthLayout>
              <Login />
            </AuthLayout>
          }
        />

        {/* ---- Protected app shell ---- */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          <Route path="vehicles" element={<VehiclesList />} />
          <Route path="vehicles/:vehicleId" element={<VehicleDetails />} />

          <Route path="drivers" element={<DriversList />} />
          <Route path="drivers/:driverId" element={<DriverDetails />} />

          <Route path="trips" element={<TripDispatch />} />
          <Route path="trips/:tripId" element={<TripDetails />} />

          <Route path="maintenance" element={<Maintenance />} />

          {/* Fuel & Expenses is primarily a Financial Analyst surface, but Fleet
              Managers/Drivers/Admin can also log entries per README RBAC table —
              route itself stays open, write actions inside are permission-gated */}
          <Route path="fuel-expense" element={<FuelExpense />} />

          <Route path="reports" element={<Reports />} />

          <Route path="settings" element={<Settings />} />
        </Route>

        {/* ---- Fallback ---- */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;