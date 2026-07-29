/** @type {import('tailwindcss').Config} */

// Single brand palette for the whole app (user + admin): TEAL.
// The pages were inconsistent, so we collapse every accent family to one teal
// scale. This variant is a slightly DARKER light theme: a deeper teal accent
// (~#0F766E / #115E59) and a soft-gray canvas, with cards still white.
// Semantics that stay distinct: amber/yellow (moment/processing/warning),
// red/rose (errors), slate/gray (neutral surfaces & text).
const teal = {
  50: '#f0fdfa',
  100: '#ccfbf1',
  200: '#99f6e4',
  300: '#5eead4',
  400: '#2dd4bf',
  500: '#0f766e', // deep teal — primary accent
  600: '#115e59', // deeper — hover / strong
  700: '#134e4a',
  800: '#0f3d38',
  900: '#0a2e2a',
  950: '#042f2e',
};

// Neutrals: same slate ramp, but the lightest step is a soft gray so page
// canvases read a touch darker than pure white (cards stay #fff).
const slate = {
  50: '#eef2f6',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
};

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        teal,
        slate,
        indigo: teal,
        violet: teal,
        purple: teal,
        fuchsia: teal,
        sky: teal,
        blue: teal,
        cyan: teal,
        emerald: teal,
        green: teal,
        orange: teal,
      },
    },
  },
  plugins: [],
};
