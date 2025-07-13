import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
  ],
  
  daisyui: {
    themes: ["light", "dark", "cupcake", "synthwave"], // Just test these 4 first
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
  },
};

export default config;