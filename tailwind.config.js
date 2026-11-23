/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { navy: '#0A1F3A', cyan: '#00B8D9', bg: '#F5F9FA' },
        night: { bg: '#06121F', card: '#0C1D33', soft: '#122845', line: '#1A3150' },
        line: '#E2EAF0',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'Sora', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
};
