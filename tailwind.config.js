/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1C1917',
        cream: '#FAF6EF',
        surface: '#FFFFFF',
        clay: '#C4562F',
        sage: '#4A6B4E',
        muted: '#8A817A',
        line: '#E6DED2',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Fraunces', 'serif'],
      },
    },
  },
  plugins: [],
}