import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "../components/layout/Sidebar";
import { Navbar } from "../components/layout/Navbar";

/**
 * AppLayout — the shell every authenticated page renders inside
 * (wired up via a parent <Route element={<AppLayout />}> in routes/, with
 * child routes rendering into <Outlet /> here).
 *
 * Structure: Sidebar (fixed width, own scroll) | [Navbar (sticky) + content (scrolls)]
 *
 * Page transitions: content is wrapped in AnimatePresence keyed by pathname,
 * so every page change gets a consistent subtle fade+rise — individual pages
 * don't need to implement their own entrance animation for the page-level shell.
 */
export function AppLayout() {
  const location = useLocation();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-base-black overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onOpenCommandPalette={() => setCommandPaletteOpen(true)} />

        <main className="flex-1 overflow-y-auto relative">
          {/* Faint ambient grid backdrop behind all content — consistent with the
              dark/glass aesthetic without competing with page content */}
          <div className="absolute inset-0 grid-bg pointer-events-none opacity-[0.4]" />

          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 p-6 lg:p-8 max-w-[1600px] mx-auto"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* commandPaletteOpen is threaded through for the future CommandPalette component
          (Ctrl+K premium feature) — intentionally not rendered yet to avoid an empty
          placeholder component; wired here so Navbar's button already does something
          real once that file exists. */}
    </div>
  );
}

export default AppLayout;