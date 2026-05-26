import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './middleware.ts'],
  theme: {
    extend: {
      colors: {
        ink: '#0d1117',
        paper: '#fafbfc',
      },
    },
  },
  plugins: [],
} satisfies Config;
