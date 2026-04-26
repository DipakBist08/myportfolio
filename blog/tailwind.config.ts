import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'
import plugin from 'tailwindcss/plugin'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './content/**/*.mdx',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366f1',
          light: '#818cf8',
          dark: '#4f46e5',
        },
        secondary: {
          DEFAULT: '#8b5cf6',
        },
        accent: {
          DEFAULT: '#06b6d4',
          light: '#22d3ee',
        },
        surface: {
          dark: '#0f172a',
          darker: '#020617',
          card: '#1e293b',
          'card-hover': '#334155',
          glass: 'rgba(30, 41, 59, 0.7)',
        },
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 30px rgba(99, 102, 241, 0.3)',
        'glow-sm': '0 0 15px rgba(99, 102, 241, 0.2)',
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 10px 25px rgba(99, 102, 241, 0.12), 0 4px 10px rgba(0,0,0,0.06)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        'gradient-accent': 'linear-gradient(135deg, #06b6d4, #6366f1)',
      },
      typography: () => ({
        DEFAULT: {
          css: {
            // Dark mode defaults (our default theme)
            '--tw-prose-body': '#cbd5e1',
            '--tw-prose-headings': '#f1f5f9',
            '--tw-prose-lead': '#94a3b8',
            '--tw-prose-links': '#818cf8',
            '--tw-prose-bold': '#f1f5f9',
            '--tw-prose-counters': '#94a3b8',
            '--tw-prose-bullets': '#475569',
            '--tw-prose-hr': '#1e293b',
            '--tw-prose-quotes': '#cbd5e1',
            '--tw-prose-quote-borders': '#6366f1',
            '--tw-prose-captions': '#64748b',
            '--tw-prose-code': '#22d3ee',
            '--tw-prose-pre-code': '#e2e8f0',
            '--tw-prose-pre-bg': '#0d1117',
            '--tw-prose-th-borders': '#334155',
            '--tw-prose-td-borders': '#1e293b',
            maxWidth: 'none',
            fontSize: '1.0625rem',
            lineHeight: '1.8',
            a: {
              textDecoration: 'none',
              fontWeight: '500',
              '&:hover': { textDecoration: 'underline', textUnderlineOffset: '3px' },
            },
            'h2': { fontSize: '1.5rem', fontWeight: '700', marginTop: '2rem', marginBottom: '0.75rem' },
            'h3': { fontSize: '1.25rem', fontWeight: '600', marginTop: '1.5rem', marginBottom: '0.5rem' },
            'pre': { backgroundColor: 'transparent', padding: '0', margin: '0' },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            code: {
              backgroundColor: 'rgba(30, 41, 59, 0.8)',
              padding: '0.2em 0.45em',
              borderRadius: '0.375rem',
              fontSize: '0.875em',
              fontWeight: '400',
              color: '#22d3ee',
            },
            blockquote: {
              borderLeftColor: '#6366f1',
              borderLeftWidth: '3px',
              paddingLeft: '1rem',
              fontStyle: 'normal',
              color: '#94a3b8',
            },
            'blockquote p:first-of-type::before': { content: '""' },
            'blockquote p:last-of-type::after': { content: '""' },
            'ul > li::marker': { color: '#475569' },
            'ol > li::marker': { color: '#64748b' },
            table: { fontSize: '0.9rem' },
            'thead th': { color: '#94a3b8', fontWeight: '600' },
          },
        },
      }),
    },
  },
  plugins: [
    typography,
    // Makes `light:` a real Tailwind variant — applies when html has .light class
    plugin(({ addVariant }) => {
      addVariant('light', '.light &')
    }),
  ],
}

export default config
