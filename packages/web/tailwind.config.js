/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-ui)", "Inter", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Lora", "Georgia", "serif"],
        display: ["var(--font-display)", "'Playfair Display'", "Georgia", "serif"],
        mono: ["var(--font-mono)", "'JetBrains Mono'", "monospace"],
        pixel: ["'Press Start 2P'", "monospace"],
      },
      colors: {
        surface: { DEFAULT: "#f5efe0", elevated: "#fbf6e9", dark: "#1a1714" },
        paper: { edge: "#e8dcc0" },
        ink: { DEFAULT: "#1a1612", secondary: "#3d3528", dark: "#ece3d2" },
        muted: { DEFAULT: "#6b6048", dark: "#948868" },
        subtle: { DEFAULT: "#a99c7a", dark: "#6b604a" },
        border: { DEFAULT: "#d4c9ab", light: "#e8dcc0", dark: "#403628" },
        rule: { DEFAULT: "#d4c9ab", dark: "#403628" },
        gold: {
          DEFAULT: "#a67c2f",
          soft: "#c9a45f",
          bg: "#f0e3c4",
          dark: "#d4a853",
        },
        accent: {
          DEFAULT: "#a67c2f",
          dark: "#d4a853",
        },
        oxblood: { DEFAULT: "#6b1d1d", subtle: "#f3d8d8", dark: "#c46666" },
        forest: { DEFAULT: "#2d4a2b", subtle: "#dde8da", dark: "#6ea368" },
        cream: { DEFAULT: "#f0e3c4", dark: "#3a2f15" },
        glass: {
          light: "rgba(245, 239, 224, 0.85)",
          dark: "rgba(26, 23, 20, 0.85)",
        },
      },
      borderRadius: {
        sharp: "2px",
        card: "2px",
        "card-lg": "6px",
        md: "var(--radius)",
        lg: "calc(var(--radius) + 2px)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(26,22,18,0.04)",
        "card-hover": "0 4px 16px rgba(26,22,18,0.10)",
        "card-lg": "0 4px 16px rgba(26,22,18,0.08)",
        glass: "var(--glass-shadow)",
      },
      animation: {
        "spring-in": "spring-in 0.4s cubic-bezier(0.23, 1, 0.32, 1)",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-slide-up": "fade-slide-up 0.4s cubic-bezier(0.23, 1, 0.32, 1)",
        "slide-up": "slide-up 0.3s ease-out",
        shimmer: "shimmer 1.5s ease-in-out infinite",
        "pulse-cursor": "pulse-cursor 1s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
      },
      keyframes: {
        "spring-in": {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-cursor": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};