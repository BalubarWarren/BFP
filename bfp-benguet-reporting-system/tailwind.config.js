/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bfp-red': '#CC0000',
        'bfp-navy': '#1A2B4A',
        'bfp-green': '#2E7D32',
        'bfp-amber': '#F59E0B',
      },
    },
  },
  plugins: [],
}
