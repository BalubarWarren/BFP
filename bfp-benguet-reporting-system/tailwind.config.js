const colors = require('tailwindcss/colors');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    // Class names also live in lib/ (e.g. StatusBadge's colours in lib/utils.js) — without this,
    // Tailwind never generated them and status badges rendered with no background.
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Every `gray-*` in the app renders as slate: a cool, slightly blue-tinted neutral that sits
        // with the BFP navy accent instead of fighting it. One swap here keeps every page's surfaces,
        // borders and secondary text on the same scale.
        gray: colors.slate,
        'bfp-red': '#CC0000',
        'bfp-navy': '#1A2B4A',
        'bfp-navy-light': '#2A4373',
        'bfp-green': '#2E7D32',
        'bfp-amber': '#F59E0B',
        'bfp-gold': '#D4AF37',
      },
      // Shadows double as a crisp 1px hairline border (the --hairline ring), so the many panels
      // styled as `bg-white rounded-lg shadow-md` get the same bordered, low-elevation look as
      // .card without editing each one. --hairline flips for dark mode in styles/globals.css.
      boxShadow: {
        // No hairline on `sm`: it is usually paired with an explicit `border` already.
        sm: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
        DEFAULT: '0 0 0 1px var(--hairline), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        md: '0 0 0 1px var(--hairline), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        lg: '0 0 0 1px var(--hairline), 0 8px 24px -6px rgb(15 23 42 / 0.12)',
        xl: '0 0 0 1px var(--hairline), 0 16px 40px -12px rgb(15 23 42 / 0.18)',
        '2xl': '0 0 0 1px var(--hairline), 0 24px 64px -16px rgb(15 23 42 / 0.28)',
      },
      backgroundImage: {
        'hazard-stripe': 'repeating-linear-gradient(45deg, #D4AF37 0 10px, #1A2B4A 10px 20px)',
      },
    },
  },
  plugins: [],
}
