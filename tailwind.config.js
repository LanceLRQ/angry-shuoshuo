/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 主题色，原创素材替换后可在此调整 UI 外壳配色
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
      },
      fontFamily: {
        display: ['"Baloo 2"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
