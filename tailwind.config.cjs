/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          500: '#00FF9C',
          600: '#00E5FF',
          700: '#9D00FF',
        },
        terminal: {
          bg: '#000000',
          text: '#00FF9C',
          accent: '#00E5FF',
        },
      },
      boxShadow: {
        neon: '0 0 0 1px rgba(0, 255, 156, 0.45), 0 0 36px rgba(0, 229, 255, 0.24)',
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
