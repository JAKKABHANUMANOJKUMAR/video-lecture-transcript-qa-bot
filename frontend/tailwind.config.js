/** @type {import('tailwindcss').Config} */

// Single brand palette for the whole app (user + admin): TEAL.
// The pages were inconsistent (login used green, dashboard used indigo, the
// library used assorted subject colors). We collapse every accent family to one
// teal scale here — recoloring the entire app from one place instead of editing
// each component. Semantics that stay distinct:
//   • amber / yellow  -> "the moment" + in-progress / processing / warning
//   • red / rose      -> errors / destructive
//   • slate / gray    -> neutral surfaces & text
const teal = {
  50: '#f0fdfa',
  100: '#ccfbf1',
  200: '#99f6e4',
  300: '#5eead4',
  400: '#2dd4bf',
  500: '#14b8a6',
  600: '#0d9488',
  700: '#0f766e',
  800: '#115e59',
  900: '#134e4a',
  950: '#042f2e',
};

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        teal,
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
