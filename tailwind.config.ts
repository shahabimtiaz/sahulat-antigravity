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
        bg: { DEFAULT: "#0a0a0b", soft: "#111114", elev: "#17171c" },
        ink: { DEFAULT: "#f5f5f7", muted: "#a1a1aa", dim: "#71717a" },
        line: { DEFAULT: "#27272a", soft: "#1f1f23" },
        brand: { DEFAULT: "#7c5cff", soft: "#a78bfa", dim: "#4c1d95" },
        accent: { DEFAULT: "#10b981", soft: "#34d399" },
        warn: { DEFAULT: "#f59e0b" },
        danger: { DEFAULT: "#ef4444" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      animation: {
        "pulse-soft": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
