import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#EA580C", // warm orange
          bg: "#FAFAF9",      // very light warm-gray
          text: "#1C1917",    // dark charcoal
          accent: "#FFEDD5",  // muted amber/cream
        },
      },
    },
  },
  plugins: [],
};
export default config;
