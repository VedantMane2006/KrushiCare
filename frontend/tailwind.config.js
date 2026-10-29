/** @type {import('tailwindcss').Config} */
// Palette from Saad (2026-10-29): chili #7c1a10, tomato #d63121, wheat #f5dea4, field #558934, forest #274636.
// The old scale names (leaf, red, amber, sky, gray) are remapped onto it so every screen follows the palette.
const palette = {
  chili: '#7c1a10',
  tomato: '#d63121',
  wheat: '#f5dea4',
  field: '#558934',
  forest: '#274636',
  paper: '#ecdfc4',
  ink: '#1f2a22',
};

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Hind', 'system-ui', 'sans-serif'],
        display: ['"Zilla Slab"', 'Martel', 'Georgia', 'serif'],
      },
      borderRadius: { xl: '0.5rem', '2xl': '0.625rem' },
      colors: {
        ...palette,
        leaf: { 50: '#eef3e6', 100: '#dde8cf', 600: '#558934', 700: '#3f6b26', 800: '#274636', 900: '#1b3226' },
        red: { 50: '#fbeae5', 100: '#f6d4cb', 600: '#d63121', 700: '#a92617', 800: '#7c1a10', 900: '#5c130b' },
        amber: {
          50: '#fdf7e8', 100: '#f9ebc6', 200: '#f5dea4', 400: '#ecc66e', 500: '#c98f2a',
          800: '#7a5212', 900: '#5e3e0d', 950: '#3b2708',
        },
        orange: { 100: '#f9e3d3', 400: '#d63121', 950: '#5c130b' },
        sky: { 50: '#f0eedf', 100: '#e5e3cc', 600: '#274636', 800: '#274636', 900: '#1b3226', 950: '#1b3226' },
        slate: { 700: '#3a3a30' },
        gray: {
          50: '#faf6ec', 100: '#f1ebdb', 200: '#e5ddc8', 300: '#d2c8ad', 400: '#aea486', 500: '#857c62',
          600: '#635c47', 700: '#4a4535', 800: '#332f24', 900: '#211f17',
        },
      },
    },
  },
  plugins: [],
};
