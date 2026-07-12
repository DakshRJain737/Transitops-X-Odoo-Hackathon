import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Bell,
  ChevronRight,
  Settings,
  LogOut,
  User,
  Command,
  AlertTriangle,
  Wrench,
  CheckCircle2,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { useAuthStore } from "../../store/authStore";
import { ROLE_META } from "../../constants/roles";
import { Badge } from "../ui/Badge";

/**
 * Mock notification feed. README has no notifications endpoint, so this is
 * local state shaped like real data would be — swap for a real query later
 * without touching any layout/animation logic here.
 */
const MOCK_NOTIFICATIONS = [
  {
    id: "n1",
    icon: AlertTriangle,
    color: "warning",
    title: "License expiring soon",
    detail: "Alex Morgan's license expires in 5 days",
    time: "2h ago",
  },
  {
    id: "n2",
    icon: Wrench,
    color: "info",
    title: "Maintenance due",
    detail: "Van-05 scheduled for oil change",
    time: "5h ago",
  },
  {
    id: "n3",
    icon: CheckCircle2,
    color: "success",
    title: "Trip completed",
    detail: "Trip #TR-2291 completed successfully",
    time: "1d ago",
  },
];

/** Human-readable labels for breadcrumb segments — falls back to capitalized slug */
const SEGMENT_LABELS = {
  dashboard: "Dashboard",
  vehicles: "Vehicles",
  drivers: "Drivers",
  trips: "Trip Dispatch",
  maintenance: "Maintenance",
  "fuel-expense": "Fuel & Expenses",
  reports: "Reports",
  settings: "Settings",
};

export function Navbar({ onOpenCommandPalette }) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const roleMeta = user?.role ? ROLE_META[user.role] : null;

  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const notifRef = useRef(null);
  const avatarRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const segments = location.pathname.split("/").filter(Boolean);

  return (
    <header className="sticky top-0 z-20 h-16 glass border-b border-white/[0.06] flex items-center gap-4 px-6 shrink-0">
      {/* ---- Breadcrumbs ---- */}
      <div className="flex items-center gap-1.5 text-sm shrink-0 min-w-0">
        <Link to="/dashboard" className="text-muted hover:text-zinc-200 transition-colors">
          TransitOps
        </Link>
        {segments.map((seg, i) => (
          <span key={seg + i} className="flex items-center gap-1.5 min-w-0">
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            <span
              className={cn(
                "truncate",
                i === segments.length - 1
                  ? "text-zinc-100 font-medium"
                  : "text-muted"
              )}
            >
              {SEGMENT_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1)}
            </span>
          </span>
        ))}
      </div>

      {/* ---- Global search (opens Command Palette) ---- */}
      <button
        onClick={onOpenCommandPalette}
        className="flex-1 max-w-md ml-auto flex items-center gap-2.5 px-3.5 h-9 rounded-xl bg-surface-600/60 border border-border text-left hover:border-border-strong hover:bg-surface-600 transition-colors group"
      >
        <Search className="w-4 h-4 text-zinc-500 shrink-0" />
        <span className="text-sm text-zinc-500 flex-1 truncate">
          Search vehicles, drivers, trips…
        </span>
        <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-medium text-zinc-500 bg-white/[0.06] border border-white/10 rounded px-1.5 py-0.5 shrink-0">
          <Command className="w-2.5 h-2.5" />K
        </kbd>
      </button>

      {/* ---- Notifications ---- */}
      <div className="relative shrink-0" ref={notifRef}>
        <button
          onClick={() => setNotifOpen((o) => !o)}
          aria-label="Notifications"
          className="relative w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors"
        >
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger-500 ring-2 ring-surface-900 animate-pulse-glow" />
        </button>

        <AnimatePresence>
          {notifOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-80 glass rounded-2xl shadow-card-hover border border-white/[0.08] overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-100">Notifications</span>
                <Badge color="danger" size="sm">{MOCK_NOTIFICATIONS.length} new</Badge>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {MOCK_NOTIFICATIONS.map((n) => {
                  const Icon = n.icon;
                  return (
                    <div
                      key={n.id}
                      className="flex gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer border-b border-border-subtle last:border-0"
                    >
                      <div
                        className={cn(
                          "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                          n.color === "warning" && "bg-warning-bg text-warning-400",
                          n.color === "info" && "bg-info-bg text-info-400",
                          n.color === "success" && "bg-success-bg text-success-400"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-100 truncate">{n.title}</p>
                        <p className="text-xs text-muted truncate">{n.detail}</p>
                        <p className="text-[11px] text-zinc-600 mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---- Settings shortcut ---- */}
      <Link
        to="/settings"
        aria-label="Settings"
        className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors shrink-0"
      >
        <Settings className="w-[18px] h-[18px]" />
      </Link>

      {/* ---- Avatar + role badge dropdown ---- */}
      <div className="relative shrink-0" ref={avatarRef}>
        <button
          onClick={() => setAvatarOpen((o) => !o)}
          className="flex items-center gap-2.5 pl-1 pr-2 h-9 rounded-xl hover:bg-white/[0.06] transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center text-xs font-semibold text-white ring-2 ring-white/10">
            {user?.full_name?.[0]?.toUpperCase() ?? "U"}
          </div>
          {roleMeta && (
            <Badge color={roleMeta.color} size="sm" className="hidden md:inline-flex">
              {roleMeta.shortLabel}
            </Badge>
          )}
        </button>

        <AnimatePresence>
          {avatarOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-56 glass rounded-2xl shadow-card-hover border border-white/[0.08] overflow-hidden py-1.5"
            >
              <div className="px-3.5 py-2.5 border-b border-border-subtle mb-1">
                <p className="text-sm font-medium text-zinc-100 truncate">
                  {user?.full_name ?? "User"}
                </p>
                <p className="text-xs text-muted truncate">{user?.email}</p>
              </div>
              <MenuLink to="/settings" icon={User} label="Profile" />
              <MenuLink to="/settings" icon={Settings} label="Settings" />
              <button
                onClick={clearSession}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-danger-400 hover:bg-danger-bg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

function MenuLink({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-100 transition-colors"
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  );
}

export default Navbar;