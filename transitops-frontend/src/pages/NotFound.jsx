import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Home, Terminal } from 'lucide-react';
import Button from '../components/ui/Button';

/* ─────────────────────────────────────────────────────────────────────────── *
 * DESIGN NOTES
 * ─────────────────────────────────────────────────────────────────────────── *
 * This page renders completely outside AppLayout (no sidebar / navbar) so it
 * needs its own full-screen canvas. Key visual choices:
 *
 * 1. "404" as a massive gradient hero number with a blurred reflection beneath
 *    it — achieves a "glowing neon sign" look using only Tailwind utility
 *    classes and zero extra libraries.
 *
 * 2. A thin horizontal scanline (2 px div) sweeps top-to-bottom over the 404
 *    on a 3 s infinite loop — a subtle terminal/CRT nod that signals
 *    "system error" without being cartoonish.
 *
 * 3. Three slow-moving background orbs (Framer Motion) at different scales /
 *    timings provide depth. They're blurred to 120 px so they read as
 *    atmospheric light rather than shapes.
 *
 * 4. The grid-bg overlay (from index.css) is masked with a radial gradient so
 *    the grid fades to nothing before it hits the center card — same technique
 *    used on the Login page for visual language consistency.
 *
 * 5. The bad URL is shown in a mono code block so engineers can debug
 *    broken links without opening DevTools.
 * ─────────────────────────────────────────────────────────────────────────── */

/* Floating orb config */
const ORBS = [
  {
    size: 520,
    color: 'rgba(88, 101, 242, 0.13)',
    initial: { x: -160, y: -80  },
    animate: { x: -120, y: -120 },
    duration: 9,
    delay: 0,
  },
  {
    size: 380,
    color: 'rgba(34, 211, 238, 0.08)',
    initial: { x: 200,  y: 100  },
    animate: { x: 160,  y: 60   },
    duration: 11,
    delay: 1.5,
  },
  {
    size: 300,
    color: 'rgba(167, 139, 250, 0.10)',
    initial: { x: 60,   y: 200  },
    animate: { x: 40,   y: 150  },
    duration: 13,
    delay: 3,
  },
];

export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <div className="relative min-h-screen bg-base-950 flex items-center justify-center overflow-hidden">

      {/* ── BACKGROUND LAYER ── */}
      {/* Grid overlay (fades at edges via mask in .grid-bg) */}
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

      {/* Animated ambient orbs */}
      {ORBS.map((orb, i) => (
        <motion.div
          key={i}
          initial={{ x: orb.initial.x, y: orb.initial.y, scale: 1 }}
          animate={{ x: orb.animate.x, y: orb.animate.y, scale: 1.08 }}
          transition={{
            duration: orb.duration,
            delay: orb.delay,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
          }}
          className="absolute pointer-events-none rounded-full"
          style={{
            width:  orb.size,
            height: orb.size,
            background: orb.color,
            filter: 'blur(120px)',
            top:  '50%',
            left: '50%',
            transform: `translate(-50%, -50%) translate(${orb.initial.x}px, ${orb.initial.y}px)`,
          }}
        />
      ))}

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, rgba(0,0,0,0.6) 100%)' }}
      />

      {/* ── MAIN CONTENT ── */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-lg mx-auto">

        {/* Hero "404" number with glowing reflection */}
        <div className="relative select-none mb-2" aria-hidden="true">
          {/* Main 404 */}
          <motion.p
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-[clamp(120px,22vw,200px)] font-black leading-none tracking-tighter text-gradient"
          >
            404
          </motion.p>

          {/* Blurred reflection (visual depth) */}
          <p
            className="absolute inset-0 text-[clamp(120px,22vw,200px)] font-black leading-none tracking-tighter text-gradient opacity-20 blur-2xl pointer-events-none"
            aria-hidden="true"
          >
            404
          </p>

          {/* Scanline sweep animation */}
          <motion.div
            initial={{ top: '0%' }}
            animate={{ top: '100%' }}
            transition={{
              duration: 2.8,
              ease: 'linear',
              repeat: Infinity,
              repeatDelay: 0.8,
            }}
            className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent-400/70 to-transparent pointer-events-none"
            style={{ mixBlendMode: 'screen' }}
          />
        </div>

        {/* Text content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-3 mb-8"
        >
          <h1 className="text-2xl font-bold text-zinc-50">Page Not Found</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            The page you requested doesn&apos;t exist or may have been moved.
            Double-check the URL or navigate back to safety.
          </p>

          {/* Bad URL display */}
          <div className="inline-flex items-center gap-2 bg-surface-700/60 border border-border rounded-xl px-3.5 py-2 mx-auto mt-1">
            <Terminal className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            <code className="text-xs font-mono text-zinc-400 truncate max-w-[260px]">
              {pathname}
            </code>
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto"
        >
          <Link to="/dashboard" className="w-full sm:w-auto">
            <Button
              size="lg"
              leftIcon={<Home />}
              className="w-full sm:w-auto"
              id="btn-notfound-dashboard"
            >
              Back to Dashboard
            </Button>
          </Link>

          <Button
            variant="outline"
            size="lg"
            leftIcon={<ArrowLeft />}
            onClick={() => window.history.back()}
            className="w-full sm:w-auto"
            id="btn-notfound-back"
          >
            Go Back
          </Button>
        </motion.div>

        {/* Footer hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="mt-10 text-xs text-zinc-600"
        >
          TransitOps · Fleet Management Platform
        </motion.p>
      </div>
    </div>
  );
}
