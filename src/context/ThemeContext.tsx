import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Theme } from '../types';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const applyThemeToDOM = (theme: Theme, animate = false) => {
  const root = document.documentElement;

  if (animate) {
    root.classList.add('theme-transitioning');
    window.setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 200);
  }

  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }

  const meta = document.getElementById('theme-color-meta') || document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0A0D14' : '#F8FAFC');
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('vortex_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    } catch {
      return 'dark';
    }
  });

  // Apply theme to DOM on mount and when theme changes
  useEffect(() => {
    applyThemeToDOM(theme, false);
  }, [theme]);

  // Listen to system preference changes if user hasn't explicitly set vortex_theme
  useEffect(() => {
    const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    if (!mediaQuery) return;

    const handler = (e: MediaQueryListEvent) => {
      try {
        const saved = localStorage.getItem('vortex_theme');
        // Only react to system preference if user hasn't chosen explicitly
        if (!saved) {
          const newTheme: Theme = e.matches ? 'dark' : 'light';
          applyThemeToDOM(newTheme, true);
          setThemeState(newTheme);
        }
      } catch {
        // storage access restricted
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else if ('addListener' in mediaQuery) {
      // Compatibility for older engines
      (mediaQuery as unknown as { addListener: (cb: typeof handler) => void }).addListener(handler);
      return () => (mediaQuery as unknown as { removeListener: (cb: typeof handler) => void }).removeListener(handler);
    }
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    applyThemeToDOM(newTheme, true);
    setThemeState(newTheme);
    try {
      localStorage.setItem('vortex_theme', newTheme);
    } catch {
      /* Storage may be disabled */
    }
  }, []);

  // Side effects (DOM + localStorage) live in setTheme; no state updater here performs them.
  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
