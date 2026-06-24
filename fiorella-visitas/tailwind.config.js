/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        rose: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
        },
        blush: {
          50: '#fdf6f8',
          100: '#faedf2',
          200: '#f5dbe7',
          300: '#edb8ce',
          400: '#e090b0',
          500: '#cc6490',
        },
        sage: {
          50: '#f6f8f6',
          100: '#e8f0e8',
          200: '#c8dcc8',
          300: '#9abf9a',
          400: '#6a9e6a',
          500: '#4a7c4a',
        },
        cream: '#fdf8f5',
        petal: '#f9eef3',
      },
      fontFamily: {
        display: ['Georgia', 'Cambria', 'serif'],
        body: ['system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
