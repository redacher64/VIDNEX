/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      letterSpacing: {
        'swiss': '-0.025em',
      }
    },
  },
  plugins: [],
}
