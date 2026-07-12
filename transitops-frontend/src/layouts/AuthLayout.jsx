import { motion } from "framer-motion";
import { Zap, ShieldCheck, TrendingUp, Truck } from "lucide-react";

/**
 * AuthLayout — split-screen shell for Login (and future Register/Forgot Password).
 * Left: brand panel — animated gradient blobs, grid texture, floating stat cards.
 * Right: plain surface where the actual form (children) renders.
 *
 * On mobile (<lg), the brand panel collapses to a compact top banner so the
 * form is immediately visible without scrolling past a full illustration.
 */
export function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex bg-base-black">
      {/* ---- Left: Brand panel ---- */}
      <div className="hidden lg:flex lg:w-[46%] relative overflow-hidden bg-surface-900 border-r border-white/[0.06]">
        {/* Animated ambient gradient blobs — pure decorative depth, low opacity so text stays legible */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-accent-500/20 blur-3xl animate-float" />
          <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] rounded-full bg-accent-700/20 blur-3xl animate-float-delayed" />
          <div className="absolute inset-0 grid-bg opacity-60" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-glow-md">
              <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-semibold text-white tracking-tight">
              TransitOps
            </span>
          </motion.div>

          {/* Tagline + stat cards */}
          <div className="space-y-10">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
                Smart transport operations,{" "}
                <span className="text-gradient">under one roof.</span>
              </h1>
              <p className="text-zinc-400 mt-4 text-base leading-relaxed max-w-md">
                Fleet, drivers, dispatch, maintenance, and cost visibility —
                enforced business rules, real-time status, zero spreadsheets.
              </p>
            </motion.div>

            {/* Floating glass stat cards — visual richness + implied credibility */}
            <div className="grid grid-cols-3 gap-3 max-w-md">
              {[
                { icon: Truck, label: "Fleet uptime", value: "98.4%" },
                { icon: ShieldCheck, label: "Compliance", value: "100%" },
                { icon: TrendingUp, label: "Avg. ROI", value: "+21%" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.08 }}
                  whileHover={{ y: -3 }}
                  className="glass rounded-xl p-3.5 border border-white/[0.08]"
                >
                  <stat.icon className="w-4 h-4 text-accent-400 mb-2" />
                  <p className="text-lg font-semibold text-white font-data">
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">
                    {stat.label}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-xs text-zinc-600"
          >
            © {new Date().getFullYear()} TransitOps. Built for operational clarity.
          </motion.p>
        </div>
      </div>

      {/* ---- Right: Form panel ---- */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        {/* Compact mobile-only brand banner, replaces the full left panel below lg breakpoint */}
        <div className="lg:hidden absolute top-6 left-6 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-glow-sm">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">
            TransitOps
          </span>
        </div>

        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}

export default AuthLayout;