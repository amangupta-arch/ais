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
        paper: {
          50:  "#FBF8F3",
          100: "#F7F2E9",
          200: "#EFE7D5",
          300: "#E4D7BC",
        },
        ink: {
          200: "#D9D3C5",
          300: "#BFB9AA",
          400: "#9C9686",
          500: "#7A7467",
          600: "#5A5447",
          700: "#3A362C",
          800: "#24211A",
          900: "#16140F",
        },
        ember: {
          50:  "#FFF4ED",
          100: "#FFE4D0",
          200: "#FFC499",
          400: "#FF8A3D",
          500: "#F26A17",
          600: "#D4520A",
          700: "#A83F08",
        },
        moss: {
          400: "#6B8E5C",
          500: "#4F7043",
          600: "#3C5532",
        },
      },
      fontFamily: {
        serif: ["var(--font-instrument)", "Georgia", "serif"],
        sans:  ["var(--font-geist)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono:  ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(3rem, 8vw, 5.5rem)",      { lineHeight: "1.02", letterSpacing: "-0.03em" }],
        "display-lg": ["clamp(2.25rem, 5vw, 3.5rem)",   { lineHeight: "1.05", letterSpacing: "-0.025em" }],
        "display-md": ["clamp(1.75rem, 3.5vw, 2.5rem)", { lineHeight: "1.1",  letterSpacing: "-0.02em" }],
        "eyebrow":    ["0.6875rem",                      { lineHeight: "1",    letterSpacing: "0.2em" }],
      },
      borderRadius: {
        xl:  "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        paper:    "0 1px 2px rgba(22, 20, 15, 0.04), 0 4px 16px rgba(22, 20, 15, 0.04)",
        "paper-lg": "0 2px 4px rgba(22, 20, 15, 0.06), 0 16px 40px rgba(22, 20, 15, 0.08)",
        ember:    "0 8px 24px rgba(242, 106, 23, 0.18)",
      },
      transitionTimingFunction: {
        warm: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      transitionDuration: {
        220: "220ms",
        450: "450ms",
        600: "600ms",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "shake-x": {
          "0%, 100%":   { transform: "translateX(0)" },
          "20%, 60%":   { transform: "translateX(-6px)" },
          "40%, 80%":   { transform: "translateX(6px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 400ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "shake-x": "shake-x 360ms cubic-bezier(0.36, 0.07, 0.19, 0.97)",
      },
    },
  },
  plugins: [],
};

export default config;
