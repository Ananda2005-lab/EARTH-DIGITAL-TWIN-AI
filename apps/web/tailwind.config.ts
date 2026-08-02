import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * Design tokens are declared as CSS custom properties in globals.css so that the
 * dark/light themes swap without a re-render, then surfaced to Tailwind here.
 */
const config: Config = {
  darkMode: ['class'],
  content: [
    './src/app/**/*.{ts,tsx,mdx}',
    './src/components/**/*.{ts,tsx}',
    './src/features/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  future: { hoverOnlyWhenSupported: true },
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem', '2xl': '2.5rem' },
      screens: { '2xl': '1536px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        surface: {
          DEFAULT: 'hsl(var(--surface) / <alpha-value>)',
          strong: 'hsl(var(--surface-strong) / <alpha-value>)',
          muted: 'hsl(var(--surface-muted) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
          soft: 'hsl(var(--primary-soft) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          foreground: 'hsl(var(--success-foreground) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          foreground: 'hsl(var(--warning-foreground) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'hsl(var(--info) / <alpha-value>)',
          foreground: 'hsl(var(--info-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        aurora: {
          cyan: '#22d3ee',
          indigo: '#6366f1',
          violet: '#8b5cf6',
          magenta: '#d946ef',
          amber: '#f59e0b',
          emerald: '#10b981',
        },
      },
      borderRadius: {
        xs: 'calc(var(--radius) - 6px)',
        sm: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 10px)',
        '3xl': 'calc(var(--radius) + 18px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
      },
      boxShadow: {
        glass: '0 1px 0 0 hsl(var(--glass-highlight) / 0.08) inset, 0 24px 60px -24px rgb(2 6 23 / 0.65)',
        'glass-sm': '0 1px 0 0 hsl(var(--glass-highlight) / 0.06) inset, 0 12px 32px -16px rgb(2 6 23 / 0.5)',
        glow: '0 0 0 1px hsl(var(--primary) / 0.25), 0 0 32px -4px hsl(var(--primary) / 0.35)',
        'glow-lg': '0 0 0 1px hsl(var(--primary) / 0.3), 0 0 64px -8px hsl(var(--primary) / 0.5)',
        elevated: '0 32px 80px -32px rgb(2 6 23 / 0.8)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to bottom, hsl(var(--background) / 0) 0%, hsl(var(--background)) 85%)',
        'aurora-gradient':
          'radial-gradient(at 18% 12%, hsl(190 92% 52% / 0.28) 0px, transparent 55%), radial-gradient(at 82% 8%, hsl(258 92% 66% / 0.26) 0px, transparent 52%), radial-gradient(at 62% 88%, hsl(292 86% 62% / 0.2) 0px, transparent 50%)',
        'sheen': 'linear-gradient(115deg, transparent 20%, hsl(var(--glass-highlight) / 0.18) 45%, transparent 70%)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        'pulse-ring': {
          '0%': { transform: 'scale(0.7)', opacity: '0.9' },
          '80%, 100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'gradient-pan': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'fade-in-up': 'fade-in-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 2.2s infinite',
        'spin-slow': 'spin-slow 22s linear infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.24, 0.6, 0.35, 1) infinite',
        float: 'float 6s ease-in-out infinite',
        'gradient-pan': 'gradient-pan 8s ease infinite',
        'accordion-down': 'accordion-down 0.25s ease-out',
        'accordion-up': 'accordion-up 0.25s ease-out',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
        snappy: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      backdropBlur: { xs: '2px', '3xl': '64px' },
      zIndex: { globe: '1', overlay: '20', panel: '30', header: '40', modal: '50', toast: '60' },
    },
  },
  plugins: [animate],
};

export default config;
