/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        plum: { DEFAULT: '#2B1B2E', deep: '#1E1320', soft: '#3D2A41' },
        champagne: { DEFAULT: '#C9A24B', light: '#E4C97E', pale: '#F5ECD7' },
        terracotta: { DEFAULT: '#B5654A', soft: '#C97D63' },
        cream: { DEFAULT: '#FAF6EF', deep: '#F2EADD' },
        ink: '#1A1216',
      },
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        body: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      // Soft-UI-evolution depth: softer than flat, clearer than neumorphism.
      boxShadow: {
        xs: '0 1px 2px rgba(43, 27, 46, 0.06)',
        sm: '0 2px 8px rgba(43, 27, 46, 0.06), 0 1px 2px rgba(43, 27, 46, 0.04)',
        md: '0 8px 24px rgba(43, 27, 46, 0.08), 0 2px 6px rgba(43, 27, 46, 0.05)',
        lg: '0 18px 48px rgba(43, 27, 46, 0.12), 0 6px 14px rgba(43, 27, 46, 0.06)',
        glow: '0 0 0 1px rgba(201, 162, 75, 0.25), 0 12px 40px rgba(201, 162, 75, 0.18)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      maxWidth: {
        prose: '68ch',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        rise: 'rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.5s ease-out both',
        'scale-in': 'scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}
