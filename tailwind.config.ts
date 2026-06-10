import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: "#0B3D2E",      // gece maçı çim yeşili (arka plan)
        "pitch-deep": "#07291F", // koyu panel
        cream: "#F4EFE3",      // metin / kart
        "tr-red": "#E30A17",   // Türk bayrağı kırmızısı (vurgu)
        gold: "#E8B04B",       // stadyum ışığı / kupa
        line: "rgba(244,239,227,0.14)",
      },
      fontFamily: {
        display: ["var(--font-oswald)", "system-ui", "sans-serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
