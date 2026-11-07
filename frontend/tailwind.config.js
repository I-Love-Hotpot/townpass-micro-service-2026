/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      fontFamily: { sans: ['PingFang TC', 'Roboto', 'system-ui', 'sans-serif'] },
      colors: {
        brand: '#5AB4C5',
        'brand-dark': '#356C77',
        'brand-light': '#EDF8FA',
        ink: '#30383D',
        muted: '#475259',
        line: '#E3E7E9',
        surface: '#F1F3F4'
      }
    }
  },
  plugins: []
};
