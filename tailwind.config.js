/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        monkee: {red: '#B71C1C', dark: '#111113'},
      },
    },
  },
  plugins: [], // <- no @tailwindcss/forms on v4
}
