import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // 오늘의 재고(판매용 소개 사이트) 브랜드 — 주황/앰버
        brand: {
          50: "#fff8f1",
          100: "#ffedd8",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f76707",
          600: "#d9480f",
          700: "#b83d0c",
          800: "#8f310e",
          900: "#6f2a10",
        },
      },
    },
  },
  plugins: [],
};
export default config;
