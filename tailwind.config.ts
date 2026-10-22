import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0f17",
        panel: "#121826",
        accent: "#5b8cff",
        good: "#2fbf71",
        warn: "#f5a524",
        bad: "#f23a53",
      },
    },
  },
  plugins: [],
};

export default config;
