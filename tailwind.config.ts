
import type { Config } from 'tailwindcss';
const { fontFamily } = require("tailwindcss/defaultTheme")

export default {
  darkMode: ['class'],
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
        code: ['monospace'],
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
        sabflow: {
          'wachat-icon': '#00C853', 'wachat-bg': '#B9F6CA',
          'sabchat-icon': '#6200EA', 'sabchat-bg': '#D1C4E9',
          'meta-icon': '#1877F2', 'meta-bg': '#BBDEFB',
          'instagram-icon': '#E1306C', 'instagram-bg': '#F8BBD0',
          'crm-icon': '#009688', 'crm-bg': '#B2DFDB',
          'email-icon': '#FF9800', 'email-bg': '#FFE0B2',
          'sms-icon': '#0288D1', 'sms-bg': '#B3E5FC',
          'url-shortener-icon': '#7B1FA2', 'url-shortener-bg': '#E1BEE7',
          'qr-code-maker-icon': '#455A64', 'qr-code-maker-bg': '#CFD8DC',
          'seo-suite-icon': '#43A047', 'seo-suite-bg': '#C8E6C9',
          'api-icon': '#1E88E5', 'api-bg': '#BBDEFB',
          'array_function-icon': '#8E24AA', 'array_function-bg': '#E1BEE7',
          'code-icon': '#F4511E', 'code-bg': '#FFCCBC',
          'data_forwarder-icon': '#3949AB', 'data_forwarder-bg': '#C5CAE9',
          'data_transformer-icon': '#00897B', 'data_transformer-bg': '#B2DFDB',
          'datetime_formatter-icon': '#6D4C41', 'datetime_formatter-bg': '#D7CCC8',
          'delay-icon': '#FF5722', 'delay-bg': '#FFCCBC',
          'dynamic_web_page-icon': '#00796B', 'dynamic_web_page-bg': '#B2DFDB',
          'file_uploader-icon': '#5C6BC0', 'file_uploader-bg': '#C5CAE9',
          'filter-icon': '#9C27B0', 'filter-bg': '#E1BEE7',
          'iterator-icon': '#039BE5', 'iterator-bg': '#B3E5FC',
          'json_extractor-icon': '#0097A7', 'json_extractor-bg': '#B2EBF2',
          'lookup_table-icon': '#7E57C2', 'lookup_table-bg': '#D1C4E9',
          'number_formatter-icon': '#F9A825', 'number_formatter-bg': '#FFF59D',
          'connect_manager-icon': '#303F9F', 'connect_manager-bg': '#C5CAE9',
          'hook-icon': '#D32F2F', 'hook-bg': '#FFCDD2',
          'subscription_billing-icon': '#512DA8', 'subscription_billing-bg': '#D1C4E9',
          'router-icon': '#455A64', 'router-bg': '#CFD8DC',
          'select_transform_json-icon': '#5E35B1', 'select_transform_json-bg': '#D1C4E9',
          'text_formatter-icon': '#00838F', 'text_formatter-bg': '#B2EBF2',
          'google_sheets-icon': '#0F9D58', 'google_sheets-bg': '#C8E6C9',
          'stripe-icon': '#635BFF', 'stripe-bg': '#C5CAE9',
          'shopify-icon': '#96BF48', 'shopify-bg': '#DCEDC8',
          'slack-icon': '#4A154B', 'slack-bg': '#E1BEE7',
          'discord-icon': '#5865F2', 'discord-bg': '#C5CAE9',
          'notion-icon': '#000000', 'notion-bg': '#E0E0E0',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
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
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'collapsible-down': 'collapsible-down 0.2s ease-out',
        'collapsible-up': 'collapsible-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
