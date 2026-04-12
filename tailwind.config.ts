
import type { Config } from 'tailwindcss';
const { fontFamily } = require("tailwindcss/defaultTheme")

export default {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      backgroundImage: {
        'glass-gradient': 'linear-gradient(180deg, hsla(0,0%,100%,0.8), hsla(0,0%,100%,0.2))',
        'glass-gradient-dark': 'linear-gradient(180deg, hsla(220,10%,18%,0.8), hsla(220,10%,12%,0.2))',
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
        headline: ["var(--font-sans)", ...fontFamily.sans],
        display: ["var(--font-sans)", ...fontFamily.sans],
        code: ['ui-monospace', 'Cascadia Code', 'Source Code Pro', 'monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        /* ── Clay design system ── */
        clay: {
          bg:            'hsl(var(--clay-bg))',
          'bg-2':        'hsl(var(--clay-bg-2))',
          surface:       'hsl(var(--clay-surface))',
          'surface-2':   'hsl(var(--clay-surface-2))',
          border:        'hsl(var(--clay-border))',
          'border-strong': 'hsl(var(--clay-border-strong))',
          divider:       'hsl(var(--clay-divider))',
          ink:           'hsl(var(--clay-ink))',
          'ink-2':       'hsl(var(--clay-ink-2))',
          'ink-muted':   'hsl(var(--clay-ink-muted))',
          'ink-soft':    'hsl(var(--clay-ink-soft))',
          'ink-fade':    'hsl(var(--clay-ink-fade))',
          rose:          'hsl(var(--clay-rose))',
          'rose-hover':  'hsl(var(--clay-rose-hover))',
          'rose-active': 'hsl(var(--clay-rose-active))',
          'rose-soft':   'hsl(var(--clay-rose-soft))',
          'rose-softer': 'hsl(var(--clay-rose-softer))',
          'rose-ink':    'hsl(var(--clay-rose-ink))',
          obsidian:      'hsl(var(--clay-obsidian))',
          'obsidian-hover': 'hsl(var(--clay-obsidian-hover))',
          green:         'hsl(var(--clay-green))',
          'green-soft':  'hsl(var(--clay-green-soft))',
          amber:         'hsl(var(--clay-amber))',
          'amber-soft':  'hsl(var(--clay-amber-soft))',
          red:           'hsl(var(--clay-red))',
          'red-soft':    'hsl(var(--clay-red-soft))',
          blue:          'hsl(var(--clay-blue))',
          'blue-soft':   'hsl(var(--clay-blue-soft))',
        },
      },
      boxShadow: {
        'clay-xs':    'var(--clay-shadow-xs)',
        'clay-sm':    'var(--clay-shadow-sm)',
        'clay-card':  'var(--clay-shadow-card)',
        'clay-float': 'var(--clay-shadow-float)',
        'clay-pop':   'var(--clay-shadow-pop)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        'clay-sm': 'var(--clay-radius-sm)',
        'clay-md': 'var(--clay-radius-md)',
        'clay-lg': 'var(--clay-radius-lg)',
        'clay-xl': 'var(--clay-radius-xl)',
        'clay-2xl': 'var(--clay-radius-2xl)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'collapsible-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-collapsible-content-height)' },
        },
        'collapsible-up': {
          from: { height: 'var(--radix-collapsible-content-height)' },
          to: { height: '0' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'blur-in': {
          '0%': { filter: 'blur(4px)', opacity: '0' },
          '100%': { filter: 'blur(0)', opacity: '1' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'collapsible-down': 'collapsible-down 0.2s ease-out',
        'collapsible-up': 'collapsible-up 0.2s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'scale-in': 'scale-in 0.15s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.25s cubic-bezier(0.16,1,0.3,1)',
        'blur-in': 'blur-in 0.3s ease-out',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
