/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        serif: ["Lora", "Georgia", "Times New Roman", "serif"],
        display: ["'Playfair Display'", "Lora", "Georgia", "serif"],
        pixel: ["'Press Start 2P'", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: "#faf8f2",
          dark: "#1a1614",
        },
        ink: {
          DEFAULT: "#1a1a1a",
          dark: "#e8e0d5",
        },
        muted: {
          DEFAULT: "#6b6b6b",
          dark: "#8c8273",
        },
        subtle: {
          DEFAULT: "#b0ada6",
          dark: "#5a5248",
        },
        border: {
          DEFAULT: "#d9d5cc",
          dark: "#3a3228",
        },
        accent: {
          DEFAULT: "#1e40af",
          dark: "#60a5fa",
        },
        gold: {
          DEFAULT: "#b8860b",
          dark: "#d4a853",
        },
        cream: {
          DEFAULT: "#fef3c7",
          dark: "#2a241c",
        },
        glass: {
          light: "rgba(250, 248, 242, 0.85)",
          dark: "rgba(26, 22, 20, 0.85)",
        },
      },
      borderRadius: {
        card: "4px",
        "card-lg": "8px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06)",
        "card-hover": "0 2px 12px rgba(0,0,0,0.10)",
        "card-lg": "0 4px 16px rgba(0,0,0,0.08)",
      },
      animation: {
        "spring-in": "spring-in 0.4s cubic-bezier(0.23, 1, 0.32, 1)",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        shimmer: "shimmer 1.5s ease-in-out infinite",
        "pulse-cursor": "pulse-cursor 1s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        "wave-1": "wave-drift-1 22s ease-in-out infinite",
        "wave-2": "wave-drift-2 16s ease-in-out infinite",
        "wave-3": "wave-drift-3 11s ease-in-out infinite",
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
        "wave-drift-1": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-33.33%)" },
        },
        "wave-drift-2": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-33.33%)" },
        },
        "wave-drift-3": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-33.33%)" },
        },
      },
    },
  },
  plugins: [],
};