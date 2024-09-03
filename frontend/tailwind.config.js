module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        green: '#00A86B',
        gold: '#FFD700',
        black: '#000000',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
