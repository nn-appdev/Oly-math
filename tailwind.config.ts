import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: '#F5F9F6',
        ink: '#0F2A27',
        'ink-soft': '#33504B',
        line: '#DCE8E3',
        teal: {
          50: '#E3F1ED',
          100: '#D5EEE8',
          600: '#0B6B63',
          800: '#084A45',
          900: '#06312D',
        },
        sun: { 100: '#FFF3D6', 400: '#F2B134', 900: '#2B1C00' },
        sky: { 100: '#D8E6F7', 600: '#2F6FB5', 800: '#1F4E80' },
        coral: { 100: '#F9DCD2', 500: '#E4572E', 800: '#8F2D0C' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        body: ['"Nunito Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '24px' },
    },
  },
  plugins: [],
} satisfies Config;
