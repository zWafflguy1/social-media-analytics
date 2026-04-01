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
        brand: {
          meta: '#1877F2',
          linkedin: '#0A66C2',
          instagram: '#E1306C',
        },
      },
    },
  },
  plugins: [],
};

export default config;
