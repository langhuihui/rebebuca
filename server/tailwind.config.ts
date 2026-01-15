import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Rebebuca brand colors - based on logo
        primary: {
          50: '#f5f0ff',
          100: '#ede5ff',
          200: '#dccfff',
          300: '#c4a8ff',
          400: '#a875ff',
          500: '#8b3dff',
          600: '#5A00FF', // Main brand color from logo
          700: '#4d00d9',
          800: '#4000b3',
          900: '#350095',
          950: '#1f0066',
        },
        accent: {
          50: '#edfff8',
          100: '#d5ffef',
          200: '#aeffe0',
          300: '#70ffc9',
          400: '#04FFAA', // Secondary brand color from logo
          500: '#00e699',
          600: '#00bf80',
          700: '#009966',
          800: '#007752',
          900: '#006144',
          950: '#003726',
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
  darkMode: 'class',
};

export default config;
