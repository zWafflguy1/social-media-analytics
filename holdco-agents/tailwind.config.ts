import type { Config } from 'tailwindcss';

export default {
  content: ['./dashboard/**/*.{ts,tsx}'],
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
