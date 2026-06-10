import React, { useState, useLayoutEffect, useRef } from 'react';
import { ThemeContext } from "./ThemeContext";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('appDarkMode');
      if (savedTheme !== null) {
        return savedTheme === 'true';
      }
      // Check system preference if no saved theme
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark;
    } catch {
      return false;
    }
  });

  const transitionTimeoutRef = useRef<number | null>(null);

  const applyThemeToRoot = (mode: boolean) => {
    const root = document.documentElement;
    root.classList.toggle('dark', mode);
    root.setAttribute('data-theme', mode ? 'dark' : 'light');
  };

  const disableTransitionsTemporarily = () => {
    const root = document.documentElement;
    root.classList.add('theme-transition-disabled');
    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
    }
    transitionTimeoutRef.current = window.setTimeout(() => {
      root.classList.remove('theme-transition-disabled');
      transitionTimeoutRef.current = null;
    }, 150);
  };

  useLayoutEffect(() => {
    applyThemeToRoot(darkMode);
    return () => {
      if (transitionTimeoutRef.current) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [darkMode]);

  const toggleDarkMode = () => {
    const nextMode = !darkMode;
    disableTransitionsTemporarily();
    applyThemeToRoot(nextMode);
    localStorage.setItem('appDarkMode', nextMode.toString());
    setDarkMode(nextMode);
  };

  return (
    <ThemeContext.Provider value={{ 
      darkMode, 
      toggleDarkMode 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
