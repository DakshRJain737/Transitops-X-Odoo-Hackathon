import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { useToastStore } from "../../store/toastStore";

const VARIANT_CONFIG = {
  success: {
    icon: CheckCircle2,
    iconClass: "text-success-400",
    barClass: "bg-success-500",
  },
  error: {
    icon: XCircle,
    iconClass: "text-danger-400",
    barClass: "bg-danger-500",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-warning-400",
    barClass: "bg-warning-500",
  },
  info: {
    icon: Info,
    iconClass: "text-info-400",
    barClass: "bg-info-500",
  },
};

/**
 * ToastContainer — mount ONCE at the app root (see App.jsx). Renders via
 * createPortal directly into document.body so it's never clipped by any
 * parent's overflow:hidden (e.g. the AppLayout's scroll containers).
 *
 * Stacks bottom-right, newest at the bottom of the stack (grows upward),
 * each toast auto-dismisses after its `duration` unless manually closed.
 */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  return createPortal(
    <div
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}

function ToastItem({ toast: t, onDismiss }) {
  const config = VARIANT_CONFIG[t.variant] ?? VARIANT_CONFIG.info;
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(onDismiss, t.duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className="pointer-events-auto relative glass rounded-xl border border-white/[0.08] shadow-card-hover overflow-hidden pl-4 pr-3 py-3 flex items-start gap-3"
    >
      {/* Left accent bar — quick color glance without reading the icon */}
      <span
        className={cn("absolute left-0 top-0 bottom-0 w-1", config.barClass)}
      />

      <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", config.iconClass)} />

      <div className="min-w-0 flex-1">
        {t.title && (
          <p className="text-sm font-semibold text-zinc-100">{t.title}</p>
        )}
        <p className="text-sm text-zinc-300 leading-snug">{t.message}</p>
      </div>

      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.08] transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

export default ToastContainer;