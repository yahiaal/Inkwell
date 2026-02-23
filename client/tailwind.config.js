/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Baloo 2"', 'cursive'],
        body: ['Nunito', 'sans-serif'],
      },
      colors: {
        bg: '#1b1f3b',
        surface: '#fdf6e3',
        'surface-alt': '#f5edd8',
        accent: '#f5a623',
        'accent-hover': '#e09415',
        secondary: '#ff6b6b',
        success: '#2ecc71',
        ink: '#1a1a2e',
        text: '#2c2c3e',
        'text-muted': '#7a7a9a',
      },
    },
  },
  plugins: [],
};
