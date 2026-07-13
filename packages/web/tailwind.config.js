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
        surface: {
          DEFAULT: "rgba(var(--surface-rgb), <alpha-value>)",
          elevated: "rgba(var(--surface-elevated-rgb), <alpha-value>)",
        },
        paper: { edge: "var(--paper-edge)" },
        ink: {
          DEFAULT: "rgba(var(--ink-rgb), <alpha-value>)",
          secondary: "var(--ink-secondary)",
        },
        muted: { DEFAULT: "var(--muted)" },
        subtle: {
          DEFAULT: "rgba(var(--subtle-rgb), <alpha-value>)",
        },
        border: {
          DEFAULT: "rgba(var(--border-rgb), <alpha-value>)",
          light: "var(--border-light)",
        },
        rule: { DEFAULT: "var(--rule)" },
        gold: {
          DEFAULT: "var(--gold)",
          soft: "var(--gold-soft)",
          bg: "var(--gold-bg)",
        },
        accent: {
          DEFAULT: "rgba(var(--accent-rgb), <alpha-value>)",
          dark: "var(--accent-dark)",
          subtle: "var(--accent-subtle)",
          bg: "rgba(var(--accent-bg-rgb), <alpha-value>)",
        },
        oxblood: {
          DEFAULT: "rgba(var(--oxblood-rgb), <alpha-value>)",
          subtle: "rgba(var(--oxblood-subtle-rgb), <alpha-value>)",
        },
        forest: { DEFAULT: "var(--forest)", subtle: "var(--forest-subtle)" },
        cream: { DEFAULT: "var(--cream)" },
        glass: {
          light: "var(--glass)",
          dark: "var(--glass)",
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