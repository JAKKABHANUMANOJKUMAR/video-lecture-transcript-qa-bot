/** @type {import('tailwindcss').Config} */

// =============================================================================
// LEKTA DESIGN SYSTEM v1 — token layer
//
// Two kinds of color live here:
//
//   1. FIXED RAMPS (`brand`, `ink`) are static hex. They are the palette
//      reference and do not change between light and dark.
//
//   2. ROLE TOKENS (`canvas`, `surface`, `content`, `accent`, `success`,
//      `warning`, `danger`, `info`, `line`) are driven by CSS variables defined
//      in index.css, so a single `dark` class on <html> re-themes the whole app.
//      Written as `rgb(var(--x) / <alpha-value>)` so opacity modifiers such as
//      `bg-surface/60` still work.
//
// Prefer role tokens in new code (`bg-surface`, `text-content-muted`,
// `border-line`). The raw ramps are for gradients and illustration, not chrome.
//
// LEGACY ALIASES: the pages still contain ~342 uses of indigo/purple/blue/
// green/emerald etc. from before this system existed. Those families stay
// pointed at the brand ramp so appearance does not regress; they are migrated
// to role tokens page by page. Do not add new usages of them.
// =============================================================================

const withAlpha = (v) => `rgb(var(${v}) / <alpha-value>)`;

// --- Fixed ramp: brand teal. Perceptually even; no jump between 400 and 500,
// which is what made the previous ramp break on hovers and gradients.
const brand = {
  50: '#EAF4F2',
  100: '#D2E8E4',
  200: '#A6D1CA',
  300: '#6FB3A9',
  400: '#2E8F82',
  500: '#0F766E', // primary accent — carried over from the previous palette
  600: '#115E59',
  700: '#134E4A',
  800: '#0F3D38',
  900: '#0A2E2A',
  950: '#062120',
};

// --- Fixed ramp: neutrals, biased teal so they read chosen rather than
// inherited. Correctly ordered light→dark (the previous `slate` ramp had 50
// darker than 100, which inverted table headers against cards).
const ink = {
  0: '#FFFFFF',
  25: '#FAFBFB',
  50: '#F6F8F8',
  100: '#EDF1F0',
  200: '#E3E9E8',
  300: '#C9D3D1',
  400: '#94A5A3',
  500: '#6B7D7B',
  600: '#5A6B6A',
  700: '#3E4E4C',
  800: '#253331',
  900: '#0F1B1A',
  950: '#070F0E',
};

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand,
        ink,

        // --- Role tokens: these flip with the theme ---
        canvas: withAlpha('--c-canvas'),
        surface: {
          DEFAULT: withAlpha('--c-surface'),
          sunk: withAlpha('--c-surface-sunk'),
        },
        line: {
          DEFAULT: withAlpha('--c-border'),
          strong: withAlpha('--c-border-strong'),
        },
        content: {
          DEFAULT: withAlpha('--c-text'),
          body: withAlpha('--c-text-body'),
          muted: withAlpha('--c-text-muted'),
          disabled: withAlpha('--c-text-disabled'),
        },
        accent: {
          DEFAULT: withAlpha('--c-accent'),
          hover: withAlpha('--c-accent-hover'),
          soft: withAlpha('--c-accent-soft'),
          ink: withAlpha('--c-accent-ink'),
        },
        success: {
          DEFAULT: withAlpha('--c-success'),
          soft: withAlpha('--c-success-soft'),
          ink: withAlpha('--c-success-ink'),
        },
        warning: {
          DEFAULT: withAlpha('--c-warning'),
          soft: withAlpha('--c-warning-soft'),
          ink: withAlpha('--c-warning-ink'),
        },
        danger: {
          DEFAULT: withAlpha('--c-danger'),
          soft: withAlpha('--c-danger-soft'),
          ink: withAlpha('--c-danger-ink'),
        },
        info: {
          DEFAULT: withAlpha('--c-info'),
          soft: withAlpha('--c-info-soft'),
          ink: withAlpha('--c-info-ink'),
        },

        // --- Legacy compatibility. Migrated away page by page. ---
        slate: ink,
        gray: ink,
        teal: brand,
        indigo: brand,
        violet: brand,
        purple: brand,
        fuchsia: brand,
        sky: brand,
        blue: brand,
        cyan: brand,
        emerald: brand,
        green: brand,
        orange: brand,
      },

      // Role-assigned radius. 4 steps + full; nothing else.
      borderRadius: {
        sm: '6px',   // chips, tiny controls
        md: '10px',  // buttons, inputs
        lg: '14px',  // cards
        xl: '20px',  // large surfaces, modals
      },

      // Tinted elevation — shadows carry the ink hue so they sit in the
      // palette instead of greying it out.
      boxShadow: {
        e1: '0 1px 2px rgba(15,27,26,.05), 0 1px 1px rgba(15,27,26,.03)',
        e2: '0 2px 4px rgba(15,27,26,.05), 0 4px 12px rgba(15,27,26,.05)',
        e3: '0 8px 24px rgba(15,27,26,.08), 0 2px 6px rgba(15,27,26,.04)',
      },

      // Type scale. Added alongside Tailwind's defaults rather than replacing
      // them, since the existing pages lean on text-xs/sm/base heavily.
      fontSize: {
        display: ['clamp(34px, 5vw, 52px)', { lineHeight: '1.05', letterSpacing: '-0.035em', fontWeight: '680' }],
        h1: ['clamp(26px, 3.4vw, 34px)', { lineHeight: '1.15', letterSpacing: '-0.028em', fontWeight: '650' }],
        h2: ['22px', { lineHeight: '1.25', letterSpacing: '-0.02em', fontWeight: '640' }],
        h3: ['17px', { lineHeight: '1.35', letterSpacing: '-0.012em', fontWeight: '620' }],
        body: ['15px', { lineHeight: '1.6' }],
        cap: ['12.5px', { lineHeight: '1.5' }],
        label: ['11px', { lineHeight: '1.5', letterSpacing: '0.09em', fontWeight: '640' }],
      },

      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'Cascadia Code', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },

      transitionTimingFunction: {
        ease: 'cubic-bezier(.2,.6,.3,1)',
      },

      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideInUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '100% 0' },
          '100%': { backgroundPosition: '0 0' },
        },
        bounceDot: {
          '0%,60%,100%': { transform: 'translateY(0)', opacity: '.5' },
          '30%': { transform: 'translateY(-4px)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fadeIn .3s ease-in',
        'slide-in': 'slideInUp .4s cubic-bezier(.2,.6,.3,1)',
        shimmer: 'shimmer 1.4s linear infinite',
        'bounce-dot': 'bounceDot 1.2s cubic-bezier(.2,.6,.3,1) infinite',
      },
    },
  },
  plugins: [],
};
