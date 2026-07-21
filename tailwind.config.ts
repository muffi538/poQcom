import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        critical: "#d03b3b",
        high: "#ec835a",
        medium: "#fab219",
        low: "#0ca30c",
        frido: {
          yellow: "#FFD400",
          bg: "#F8F9FA",
          border: "#ECECEC",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        card: "18px",
      },
    },
  },
  plugins: [],
};

export default config;
