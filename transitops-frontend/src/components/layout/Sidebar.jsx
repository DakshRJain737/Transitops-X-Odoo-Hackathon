import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Truck,
  Users,
  Navigation,
  Wrench,
  Fuel,
  BarChart3,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Sun,
  Moon,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { useAuthStore } from "../../store/authStore";
import { canAccessNavKey, ROLE_META } from "../../constants/roles";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { key: "vehicles", label: "Vehicles", to: "/vehicles", icon: Truck },
  { key: "drivers", label: "Drivers", to: "/drivers", icon: Users },
  { key: "trips", label: "Trip Dispatch", to: "/trips", icon: Navigation },
  { key: "maintenance", label: "Maintenance", to: "/maintenance", icon: Wrench },
  { key: "fuel-expense", label: "Fuel & Expenses", to: "/fuel-expense", icon: Fuel },
  { key: "reports", label: "Reports", to: "/reports", icon: BarChart3 },
  { key: "settings", label: "Settings", to: "/settings", icon: Settings },
];

const SIDEBAR_COLLAPSE_KEY = "transitops-sidebar-collapsed";

export function Sidebar() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "true"
  );
  const [isDark, setIsDark] = useState(true); // dark-only per spec; toggle wired for future light mode

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, String(collapsed));
  }, [collapsed]);

  const role = user?.role;
  const visibleItems = NAV_ITEMS.filter((item) => canAccessNavKey(role, item.key));
  const roleMeta = role ? ROLE_META[role] : null;

  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 264 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="relative h-screen shrink-0 glass border-r border-white/[0.06] flex flex-col z-30"
    >
      {/* ---- Logo ---- */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-border-subtle shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-glow-sm shrink-0">
          <Zap className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="font-semibold text-zinc-50 tracking-tight whitespace-nowrap overflow-hidden"
            >
              TransitOps
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ---- Nav items ---- */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {visibleItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <NavItem
              key={item.key}
              item={item}
              isActive={isActive}
              collapsed={collapsed}
            />
          );
        })}
      </nav>

      {/* ---- Footer: user profile, theme toggle, collapse ---- */}
      <div className="border-t border-border-subtle p-3 shrink-0 space-y-1">
        <button
          onClick={() => setIsDark((d) => !d)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors",
            collapsed && "justify-center"
          )}
          title="Toggle theme"
        >
          {isDark ? <Moon className="w-4 h-4 shrink-0" /> : <Sun className="w-4 h-4 shrink-0" />}
          {!collapsed && <span>{isDark ? "Dark mode" : "Light mode"}</span>}
        </button>

        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl",
            collapsed && "justify-center"
          )}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center text-xs font-semibold text-white shrink-0 ring-2 ring-white/10">
            {user?.full_name?.[0]?.toUpperCase() ?? "U"}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-100 truncate">
                {user?.full_name ?? "User"}
              </p>
              <p className="text-[11px] text-muted flex items-center gap-1 truncate">
                {roleMeta?.icon === "ShieldCheck" && <ShieldCheck className="w-3 h-3 shrink-0" />}
                {roleMeta?.shortLabel ?? "—"}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={clearSession}
              title="Log out"
              aria-label="Log out"
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-danger-400 hover:bg-danger-bg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors",
            collapsed && "justify-center"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronsRight className="w-4 h-4 shrink-0" />
          ) : (
            <>
              <ChevronsLeft className="w-4 h-4 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}

function NavItem({ item, isActive, collapsed }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group",
        collapsed && "justify-center",
        isActive
          ? "text-white"
          : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]"
      )}
      title={collapsed ? item.label : undefined}
    >
      {isActive && (
        <motion.div
          layoutId="sidebar-active-indicator"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent-500/20 to-accent-600/10 border border-accent-500/25 shadow-glow-sm"
        />
      )}
      <Icon className="w-[18px] h-[18px] shrink-0 relative z-10" strokeWidth={isActive ? 2.4 : 2} />
      {!collapsed && <span className="relative z-10 whitespace-nowrap">{item.label}</span>}

      {/* Tooltip label shown only when collapsed, on hover */}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-surface-700 border border-border-strong text-xs text-zinc-100 whitespace-nowrap opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-50 shadow-card">
          {item.label}
        </span>
      )}
    </NavLink>
  );
}

export default Sidebar;