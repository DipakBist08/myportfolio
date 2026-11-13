import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'
import plugin from 'tailwindcss/plugin'

/* Tailwind is mapped onto the design tokens in app/tokens.css. The `slate`
   scale is remapped to the zinc neutrals and `primary`/`accent` resolve to
   the theme's accent through CSS variables, so every existing utility in the
   codebase follows the single-accent system without per-component edits. */

const neutral = {
  50: '#fafafa',
  100: '#f4f4f5',
  200: '#e4e4e7',
  300: '#d4d4d8',
  400: '#a1a1aa',
  500: '#8b8b96',
  600: '#52525b',
  700: '#3f3f46',
  800: '#222227',
  900: '#111114',
  950: '#0b0b0e',
}

const accent = 'rgb(var(--accent-rgb) / <alpha-value>)'
const accentSolid = 'rgb(var(--accent-solid-rgb) / <alpha-value>)'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './content/**/*.mdx',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        slate: neutral,
        zinc: neutral,
        primary: {
          DEFAULT: accentSolid,
          light: 'var(--color-accent-text)',
          dark: 'var(--color-accent-stronger)',
        },
        secondary: {
          DEFAULT: accent,
        },
        accent: {
          DEFAULT: accent,
          light: 'var(--color-accent-text)',
        },
        surface: {
          dark: neutral[900],
          darker: neutral[950],
          card: '#18181c',
          'card-hover': neutral[800],
          glass: 'rgb(11 11 14 / 0.82)',
        },
        bg: 'var(--color-bg)',
        ink: 'var(--color-text)',
        muted: 'var(--color-text-muted)',
        subtle: 'var(--color-text-subtle)',
        line: 'var(--color-border)',
        'line-strong': 'var(--color-border-strong)',
      },
      fontFamily: {
        heading: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        body: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        glow: 'var(--shadow-ring)',
        'glow-sm': 'var(--shadow-ring)',
        card: 'var(--shadow-sm)',
        'card-hover': 'var(--shadow-md)',
        lift: 'var(--shadow-lg)',
      },
      borderColor: {
        DEFAULT: 'var(--color-border)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, var(--color-accent-strong), var(--color-accent-stronger))',
        'gradient-accent': 'linear-gradient(135deg, var(--color-accent-strong), var(--color-accent-stronger))',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      maxWidth: {
        page: '1200px',
        measure: '68ch',
      },
      typography: () => ({
        DEFAULT: {
          css: {
            maxWidth: 'none',
            fontSize: '1.0625rem',
            lineHeight: '1.75',
            a: {
              textDecoration: 'underline',
              fontWeight: '500',
            },
            h2: { fontSize: '1.625rem', fontWeight: '600', marginTop: '2.5rem', marginBottom: '0.875rem', letterSpacing: '-0.02em' },
            h3: { fontSize: '1.25rem', fontWeight: '600', marginTop: '1.75rem', marginBottom: '0.5rem', letterSpacing: '-0.01em' },
            pre: { backgroundColor: 'transparent', padding: '0', margin: '0' },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            table: { fontSize: '0.9rem' },
            img: { borderRadius: '0.75rem' },
          },
        },
      }),
    },
  },
  plugins: [
    typography,
    // `light:` variant applies when the theme is light (data-theme, with the old class kept for safety)
    plugin(({ addVariant }) => {
      addVariant('light', ['[data-theme="light"] &', '.light &'])
    }),
  ],
}

export default config
