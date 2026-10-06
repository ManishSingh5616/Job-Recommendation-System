/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { DEFAULT: '#0F1F2E', soft: '#1A3147', mute: '#5B6B7B' },
        paper: '#F6F5F1',
        line: '#E4E1D8',
      },
    },
  },
  plugins: [],
};
