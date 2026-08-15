import type { Config } from 'tailwindcss';

/**
 * Design tokens — "evidence ledger".
 * Cool slate paper, deep petrol as the single brand accent, and three
 * semantic evidence colours that are used ONLY for evidence states so the
 * recruiter can read the requirement matrix rail without a legend.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0E1621',
          soft: '#2B3947',
          muted: '#5A6875',
          faint: '#8C97A3',
        },
        paper: '#FFFFFF',
        wash: '#F4F6F8',
        rule: '#DCE1E7',
        petrol: {
          50: '#EBF3F6',
          100: '#CFE2E9',
          300: '#7BAABB',
          500: '#2E7A92',
          600: '#1F5F74',
          700: '#0F3D4C',
          900: '#07242E',
        },
        evidence: {
          yes: '#15803D',
          partial: '#B45309',
          no: '#9F1239',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.06em' }],
      },
      borderRadius: { sharp: '2px' },
      boxShadow: {
        panel: '0 1px 2px rgba(14,22,33,0.04), 0 1px 12px rgba(14,22,33,0.05)',
      },
      keyframes: {
        rise: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: { rise: 'rise .28s ease-out both' },
    },
  },
  plugins: [],
};
export default config;
