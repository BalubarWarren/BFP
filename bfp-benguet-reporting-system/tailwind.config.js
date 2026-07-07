/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        'bfp-red': '#CC0000',
        'bfp-navy': '#1A2B4A',
        'bfp-navy-light': '#2A4373',
        'bfp-green': '#2E7D32',
        'bfp-amber': '#F59E0B',
        'bfp-gold': '#D4AF37',
      },
      backgroundImage: {
        'hazard-stripe': 'repeating-linear-gradient(45deg, #D4AF37 0 10px, #1A2B4A 10px 20px)',
      },
    },
  },
  plugins: [],
}
