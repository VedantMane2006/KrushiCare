/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Noto Sans"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'] },
      colors: { leaf: { 50: '#f0fdf4', 100: '#dcfce7', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d' } },
    },
  },
  plugins: [],
};
