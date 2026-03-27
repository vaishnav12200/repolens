/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          500: '#36a5ff',
          600: '#257de8',
          700: '#1b58c5',
        },
        terminal: {
          bg: '#05070f',
          text: '#93fdd8',
          accent: '#79b8ff',
        },
      },
      boxShadow: {
        neon: '0 0 0 1px rgba(54, 165, 255, 0.45), 0 0 36px rgba(54, 165, 255, 0.24)',
      },
      animation: {
        pulsegrid: 'pulsegrid 6s ease-in-out infinite',
      },
      keyframes: {
        pulsegrid: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}
