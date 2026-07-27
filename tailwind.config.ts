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
          yellow: "#FFC700",
          bg: "#F4F5F7",
          border: "#E4E4E4",
          sidebar: "#0F172A",
          sidebarActive: "#1E293B",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        card: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
