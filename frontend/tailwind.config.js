/** @type {import('tailwindcss').Config} */

// =============================================================================
// LEKTA DESIGN SYSTEM v4 — Air token layer
//
// Monochrome plus two blues: a Haze page, Whiteout cards, Ink type. Light theme
// only. Flat by rule — no elevation; 1px hairlines instead of shadows.
//
// Every color is a ROLE TOKEN driven by CSS variables defined in index.css,
// written as `rgb(var(--x) / <alpha-value>)` so opacity modifiers such as
// `bg-surface/60` still work. Swapping the palette is a one-file change
// (index.css) — component code never hardcodes a hex.
//
// Color roles:
//   canvas / surface / ink / line ... Haze page, Whiteout cards, Ink type, gray
//                                    hairlines carrying every separation
//   accent ....................... Signal Blue #2b7fff — the only saturated
//                                  accent. Links, active states, icons.
//                                  NEVER a button fill or large surface.
//   ink-black .................... #000000 Black Void — nav borders, link
//                                  underlines, deepest contrast layer
//   peach ........................ collapsed to neutral (monochrome rule)
//   mint ......................... Signal Blue
//   sky .......................... Twilight Blue #426188
//   butter / rose ................ reserved for state (warning, destructive)
//   ok / warn / danger / info .... semantic status
//
// Type roles: font-display (Fraunces) for h1/h2/hero/empty-state headlines
// only; font-sans (Manrope) for all UI; font-mono (JetBrains Mono) for
// timestamps, IDs and code. Time is the atom of this product — timestamps are
// always mono.
// =============================================================================

const withAlpha = (v) => `rgb(var(${v}) / <alpha-value>)`;

const pastel = (name) => ({
  DEFAULT: withAlpha(`--c-${name}`),
  tint: withAlpha(`--c-${name}-tint`),
  ink: withAlpha(`--c-${name}-ink`),
});

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: withAlpha('--c-canvas'),
          deep: withAlpha('--c-canvas-deep'),
        },
        surface: withAlpha('--c-surface'),
        line: {
          DEFAULT: withAlpha('--c-line'),
          strong: withAlpha('--c-line-strong'),
        },
        ink: {
          DEFAULT: withAlpha('--c-ink'),
          2: withAlpha('--c-ink-2'),
          3: withAlpha('--c-ink-3'),
          // Reserved for the single filled-button surface.
          black: withAlpha('--c-ink-black'),
        },
        // Neutral chart mark — lighter than ink-3 so it separates from the
        // green under colour-vision deficiency. Bars only, never text.
        'mark-neutral': withAlpha('--c-mark-neutral'),
        accent: {
          DEFAULT: withAlpha('--c-accent'),
          deep: withAlpha('--c-accent-deep'),
          soft: withAlpha('--c-accent-soft'),
          tint: withAlpha('--c-accent-tint'),
        },
        peach: pastel('peach'),
        mint: pastel('mint'),
        sky: pastel('sky'),
        butter: pastel('butter'),
        rose: pastel('rose'),
        ok: { DEFAULT: withAlpha('--c-ok'), tint: withAlpha('--c-ok-tint') },
        warn: { DEFAULT: withAlpha('--c-warn'), tint: withAlpha('--c-warn-tint') },
        danger: { DEFAULT: withAlpha('--c-danger'), tint: withAlpha('--c-danger-tint') },
        info: { DEFAULT: withAlpha('--c-info'), tint: withAlpha('--c-info-tint') },
      },

      // Preflight otherwise defaults every border to gray-200 (#e5e7eb), which
      // is outside the palette — point it at the hairline token instead.
      borderColor: {
        DEFAULT: withAlpha('--c-line'),
      },

      // Air's radius set: inputs 4, buttons 8, images 11, cards 12, pills full.
      // `chip` and `ctl` deliberately resolve to the same 8px — Air has one
      // button radius, and collapsing the two token names would mean editing
      // every call site rather than the token layer.
      borderRadius: {
        input: '4px',
        chip: '8px',
        ctl: '8px',
        image: '11px',
        card: '12px',
        panel: '12px',
      },

      // Air has NO elevation: surfaces separate by background contrast and 1px
      // borders, never by casting shadows. The sm/md/lg names are kept and
      // neutralised so the swap stays inside the token layer — a `shadow-sm` in
      // a component is now a no-op, and its sibling `border-line` does the work.
      // The two rings are focus affordances, not elevation, so they remain.
      boxShadow: {
        sm: 'none',
        md: 'none',
        lg: 'none',
        ring: '0 0 0 3px rgb(var(--c-accent-soft))',
        'ring-danger': '0 0 0 3px rgb(var(--c-rose-tint))',
      },

      fontFamily: {
        display: ['Fraunces', 'Georgia', 'ui-serif', 'serif'],
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Cascadia Code', 'Menlo', 'Consolas', 'monospace'],
      },

      // Scale: 12.5 / 13.5 / 15 / 17 / 20 / 24 / 30 / 38
      fontSize: {
        micro: ['11px', { lineHeight: '1.5', letterSpacing: '0.08em', fontWeight: '700' }],
        cap: ['12.5px', { lineHeight: '1.5' }],
        sm: ['13.5px', { lineHeight: '1.55' }],
        body: ['15px', { lineHeight: '1.6' }],
        lg: ['17px', { lineHeight: '1.5' }],
        h3: ['20px', { lineHeight: '1.4', letterSpacing: '-0.01em', fontWeight: '600' }],
        h2: ['24px', { lineHeight: '1.3', letterSpacing: '-0.015em', fontWeight: '600' }],
        h1: ['30px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
        display: ['clamp(32px, 4.5vw, 44px)', { lineHeight: '1.12', letterSpacing: '-0.02em', fontWeight: '550' }],
      },

      transitionTimingFunction: {
        study: 'cubic-bezier(.32,.72,0,1)',
      },
      transitionDuration: {
        micro: '160ms',
        panel: '240ms',
        page: '320ms',
      },

      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        pop: {
          '0%': { opacity: '0', transform: 'scale(.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '100% 0' },
          '100%': { backgroundPosition: '-100% 0' },
        },
        typingDot: {
          '0%,60%,100%': { transform: 'translateY(0)', opacity: '.4' },
          '30%': { transform: 'translateY(-4px)', opacity: '1' },
        },
        waveBar: {
          '0%,100%': { transform: 'scaleY(.35)' },
          '50%': { transform: 'scaleY(1)' },
        },
        pulseSoft: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '.55' },
        },
        segFlash: {
          '0%': { backgroundColor: 'rgb(var(--c-butter-tint))' },
          '100%': { backgroundColor: 'transparent' },
        },
        // A citation jump, acknowledged: a ring over the player that fades out.
        // Must never animate an ancestor of <video> — see SourceRail.
        seekPulse: {
          '0%': { opacity: '1' },
          '60%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        rise: 'rise .32s cubic-bezier(.32,.72,0,1) both',
        'fade-in': 'fadeIn .24s ease-out both',
        pop: 'pop .16s cubic-bezier(.32,.72,0,1) both',
        shimmer: 'shimmer 1.6s linear infinite',
        'typing-dot': 'typingDot 1.2s cubic-bezier(.32,.72,0,1) infinite',
        'wave-bar': 'waveBar 1.1s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2.2s ease-in-out infinite',
        'seg-flash': 'segFlash 1.6s ease-out both',
        'seek-pulse': 'seekPulse 1.5s ease-out both',
      },
    },
  },
  plugins: [],
};
