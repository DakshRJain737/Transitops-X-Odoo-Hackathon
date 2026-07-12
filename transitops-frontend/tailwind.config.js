/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class", // we force dark via class on <html>, but keep this so a future light mode is trivial to add
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base canvas — true black, not just "very dark gray" — this is what makes glow accents pop
        base: {
          black: "#000000",
          950: "#050506",
        },
        // Layered surfaces for depth (cards, sidebars, modals sit on increasing elevation)
        surface: {
          900: "#0a0a0c", // page background panels
          800: "#101013", // card background
          700: "#17171b", // elevated card / hover
          600: "#1f1f24", // input fields, chips
          500: "#2a2a31", // borders on hover
        },
        border: {
          DEFAULT: "#1f1f24",
          subtle: "#17171b",
          strong: "#2f2f38",
        },
        // Single strong accent family — electric indigo/blue, used sparingly for focus/glow/CTA
        accent: {
          50: "#eef1ff",
          100: "#e0e4ff",
          300: "#a5b0ff",
          400: "#7c8bff",
          500: "#5865f2", // primary accent
          600: "#4752c4",
          700: "#3a4299",
        },
        // Semantic status colors reused across badges, KPIs, trip/vehicle/driver states
        success: {
          400: "#4ade80",
          500: "#22c55e",
          bg: "rgba(34,197,94,0.12)",
        },
        warning: {
          400: "#fbbf24",
          500: "#f59e0b",
          bg: "rgba(245,158,11,0.12)",
        },
        danger: {
          400: "#f87171",
          500: "#ef4444",
          bg: "rgba(239,68,68,0.12)",
        },
        info: {
          400: "#60a5fa",
          500: "#3b82f6",
          bg: "rgba(59,130,246,0.12)",
        },
        muted: {
          DEFAULT: "#8b8b95",
          foreground: "#a1a1aa",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        // Soft neon glow utilities — used on hover states, active nav items, primary buttons
        "glow-sm": "0 0 12px 0 rgba(88, 101, 242, 0.25)",
        "glow-md": "0 0 24px 0 rgba(88, 101, 242, 0.35)",
        "glow-lg": "0 0 48px 0 rgba(88, 101, 242, 0.4)",
        "glow-success": "0 0 20px 0 rgba(34, 197, 94, 0.3)",
        "glow-danger": "0 0 20px 0 rgba(239, 68, 68, 0.3)",
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -8px rgba(0,0,0,0.6)",
        "card-hover": "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 16px 40px -12px rgba(0,0,0,0.7)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "grid-pattern":
          "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
        noise:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")",
      },
      backgroundSize: {
        "grid-md": "40px 40px",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) translateX(0)" },
          "50%": { transform: "translateY(-20px) translateX(10px)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out forwards",
        "slide-up": "slide-up 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-down": "slide-down 0.3s ease-out forwards",
        shimmer: "shimmer 2s infinite linear",
        float: "float 6s ease-in-out infinite",
        "float-delayed": "float 8s ease-in-out infinite 1.5s",
        "pulse-glow": "pulse-glow 2.5s ease-in-out infinite",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
      backdropBlur: {
        xs: "2px",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
    },
  },
  plugins: [],
};