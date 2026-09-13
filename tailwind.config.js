/** @type {import('tailwindcss').Config} */
const INTER = ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: INTER,
        heading: INTER,
      },
      letterSpacing: {
        heading: '-0.022em',
        display: '-0.032em',
      },
      colors: {
        base: 'hsl(var(--bg-base) / <alpha-value>)',
        surface: 'hsl(var(--bg-surface) / <alpha-value>)',
        elevated: 'hsl(var(--bg-elevated) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        'border-strong': 'hsl(var(--border-strong) / <alpha-value>)',
        input: 'hsl(var(--border) / <alpha-value>)',
        ring: 'hsl(var(--gold) / <alpha-value>)',
        background: 'hsl(var(--bg-base) / <alpha-value>)',
        foreground: 'hsl(var(--text-primary) / <alpha-value>)',
        primary: { DEFAULT: 'hsl(var(--gold) / <alpha-value>)', foreground: 'hsl(var(--gold-fg) / <alpha-value>)' },
        secondary: { DEFAULT: 'hsl(var(--bg-elevated) / <alpha-value>)', foreground: 'hsl(var(--text-primary) / <alpha-value>)' },
        muted: { DEFAULT: 'hsl(var(--bg-elevated) / <alpha-value>)', foreground: 'hsl(var(--text-muted) / <alpha-value>)' },
        accent: { DEFAULT: 'hsl(var(--bg-elevated) / <alpha-value>)', foreground: 'hsl(var(--text-primary) / <alpha-value>)' },
        popover: { DEFAULT: 'hsl(var(--bg-elevated) / <alpha-value>)', foreground: 'hsl(var(--text-primary) / <alpha-value>)' },
        card: { DEFAULT: 'hsl(var(--bg-surface) / <alpha-value>)', foreground: 'hsl(var(--text-primary) / <alpha-value>)' },
        destructive: { DEFAULT: 'hsl(var(--negative) / <alpha-value>)', foreground: 'hsl(var(--negative-fg) / <alpha-value>)' },
        txt: {
          primary: 'hsl(var(--text-primary) / <alpha-value>)',
          secondary: 'hsl(var(--text-secondary) / <alpha-value>)',
          muted: 'hsl(var(--text-muted) / <alpha-value>)',
        },
        gold: { DEFAULT: 'hsl(var(--gold) / <alpha-value>)', bright: 'hsl(var(--gold-bright) / <alpha-value>)', fg: 'hsl(var(--gold-fg) / <alpha-value>)' },
        positive: 'hsl(var(--positive) / <alpha-value>)',
        negative: { DEFAULT: 'hsl(var(--negative) / <alpha-value>)', fg: 'hsl(var(--negative-fg) / <alpha-value>)' },
        warning: 'hsl(var(--warning) / <alpha-value>)',
        orange: 'hsl(var(--orange) / <alpha-value>)',
        info: 'hsl(var(--info) / <alpha-value>)',
      },
      borderRadius: { sm: '0.375rem', md: '0.5rem', lg: '0.75rem', xl: '1rem', '2xl': '1.25rem', '3xl': '1.75rem' },
      boxShadow: {
        card: 'var(--shadow-card)',
        float: 'var(--shadow-float)',
        glow: 'var(--shadow-glow)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
