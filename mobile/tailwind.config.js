/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: "#0a0a0b", soft: "#111114", elev: "#17171c" },
        ink: { DEFAULT: "#f5f5f7", muted: "#a1a1aa", dim: "#71717a" },
        line: { DEFAULT: "#27272a", soft: "#1f1f23" },
        brand: { DEFAULT: "#7c5cff", soft: "#a78bfa" },
        accent: { DEFAULT: "#10b981", soft: "#34d399" },
        warn: "#f59e0b",
        danger: "#ef4444",
      },
    },
  },
  plugins: [],
};
