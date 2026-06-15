/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Inter Display", "system-ui", "-apple-system", "sans-serif"],
        pixel: ["'Press Start 2P'", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: "oklch(98% 0.01 80)",
          dark: "oklch(15% 0.01 50)",
        },
        ink: {
          DEFAULT: "oklch(15% 0.02 50)",
          dark: "oklch(92% 0.01 80)",
        },
        muted: {
          DEFAULT: "oklch(45% 0.02 50)",
          dark: "oklch(70% 0.01 80)",
        },
        subtle: {
          DEFAULT: "oklch(60% 0.02 50)",
          dark: "oklch(55% 0.01 80)",
        },
        border: {
          DEFAULT: "oklch(90% 0.01 80)",
          dark: "oklch(30% 0.01 50)",
        },
        accent: {
          DEFAULT: "#ea580c",
          dark: "#f97316",
        },
        glass: {
          light: "rgba(255,255,255,0.6)",
          dark: "rgba(0,0,0,0.4)",
        },
      },
      borderRadius: {
        glass: "16px",
        "glass-sm": "12px",
        "glass-lg": "24px",
      },
      backdropBlur: {
        glass: "24px",
        "glass-sm": "12px",
        "glass-lg": "40px",
      },
      boxShadow: {
        glass: "0 4px 24px rgba(0,0,0,0.06)",
        "glass-lg": "0 8px 40px rgba(0,0,0,0.10)",
        "glass-xl": "0 16px 64px rgba(0,0,0,0.12)",
        card: "0 2px 8px rgba(0,0,0,0.04)",
        "card-hover": "0 8px 32px rgba(0,0,0,0.10)",
      },
      animation: {
        "spring-in": "spring-in 0.4s cubic-bezier(0.23, 1, 0.32, 1)",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "shimmer": "shimmer 1.5s ease-in-out infinite",
        "pulse-cursor": "pulse-cursor 1s ease-in-out infinite",
        "float": "float 4s ease-in-out infinite",
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
