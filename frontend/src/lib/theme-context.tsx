import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'askora-theme';

const getSystemPrefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const resolveIsDark = (theme: Theme) =>
  theme === 'dark' || (theme === 'system' && getSystemPrefersDark());

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem(STORAGE_KEY) as Theme) || 'light';
  });

  const [isDark, setIsDark] = useState<boolean>(() => resolveIsDark(theme));

  useEffect(() => {
    const dark = resolveIsDark(theme);
    setIsDark(dark);
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    localStorage.setItem(STORAGE_KEY, theme);

    if (theme === 'system' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
        const next = mq.matches;
        setIsDark(next);
        root.classList.toggle('dark', next);
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  const setTheme = (next: Theme) => setThemeState(next);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
