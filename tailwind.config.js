/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        "surface": "#fffaf5",
        "surface-bright": "#fffaf5",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#fff7ed",
        "surface-container": "#ffedd5",
        "surface-container-high": "#fed7aa",
        "surface-container-highest": "#ffedd5",
        "on-surface": "#1f130b",
        "on-surface-variant": "#6c4e40",
        "primary": "#ea580c",
        "primary-container": "#f97316",
        "on-primary": "#ffffff",
        "secondary": "#ea580c",
        "tertiary": "#c2410c",
        "outline": "#9a6c5b",
        "outline-variant": "#fdba74",
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"Plus Jakarta Sans"', 'sans-serif'],
        sans: ['"Hanken Grotesk"', '"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(234, 88, 12, 0.05)',
        'xs': '0 1px 3px 0 rgba(234, 88, 12, 0.08), 0 1px 2px -1px rgba(234, 88, 12, 0.06)',
        'orange-glow': '0 0 35px -5px rgba(234, 88, 12, 0.25), 0 8px 20px -6px rgba(234, 88, 12, 0.2)',
        'orange-sm': '0 0 15px -3px rgba(234, 88, 12, 0.3)',
        'orange-ring': '0 0 0 3px rgba(249, 115, 22, 0.35)',
        'card-warm': '0 4px 20px -2px rgba(234, 88, 12, 0.06), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
      },
      letterSpacing: {
        'swiss': '-0.025em',
      },
    },
  },
  plugins: [],
}
