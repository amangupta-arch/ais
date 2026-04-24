import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neutrals (Tailwind slate)
        surface: {
          50: "#FAFAFA",
          100: "#FFFFFF",
          200: "#F8FAFC",
        },
        ink: {
          50:  "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
        },
        // Single cool accent — cobalt
        accent: {
          50:  "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
        },
        success: {
          50:  "#ECFDF5",
          200: "#A7F3D0",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
        },
        danger: {
          50:  "#FEF2F2",
          200: "#FECACA",
          500: "#EF4444",
          600: "#DC2626",
          700: "#B91C1C",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-xl": ["3rem",    { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-lg": ["2rem",    { lineHeight: "1.1",  letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-md": ["1.5rem",  { lineHeight: "1.2",  letterSpacing: "-0.01em", fontWeight: "700" }],
        "display-sm": ["1.25rem", { lineHeight: "1.25", letterSpacing: "-0.01em", fontWeight: "600" }],
        "eyebrow":    ["0.6875rem", { lineHeight: "1",  letterSpacing: "0.08em",  fontWeight: "500" }],
      },
      borderRadius: {
        none: "0",
        sm:  "4px",
        md:  "6px",
        lg:  "8px",
        xl: "12px",
      },
      boxShadow: {
        card:   "0 1px 0 rgba(15, 23, 42, 0.04)",
        "card-hover": "0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.04)",
        accent: "0 1px 0 rgba(37, 99, 235, 0.24)",
      },
      transitionDuration: {
        150: "150ms",
        200: "200ms",
        300: "300ms",
      },
      keyframes: {
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%":   { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "shake-x": {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px)" },
          "75%": { transform: "translateX(4px)" },
        },
      },
      animation: {
        "fade-in":  "fade-in 200ms ease-out both",
        "slide-up": "slide-up 200ms ease-out both",
        "shake-x":  "shake-x 260ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
