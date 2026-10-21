import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme = 'ocean' | 'autumn';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  isOcean: boolean;
  isAutumn: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'ocean',
  setTheme: () => {},
  isOcean: true,
  isAutumn: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem('slothify_theme') as AppTheme;
      if (saved === 'ocean' || saved === 'autumn') {
        return saved;
      }
    } catch (e) {}
    return 'ocean'; // Default is ocean theme as requested
  });

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('slothify_theme', newTheme);
    } catch (e) {}
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.remove('theme-ocean', 'theme-autumn');
    document.documentElement.classList.add(`theme-${theme}`);
    if (theme === 'ocean') {
      document.documentElement.style.setProperty('--accent-color', '#3b82f6');
      document.documentElement.style.setProperty('--selection-bg', '#2563eb');
    } else {
      document.documentElement.style.setProperty('--accent-color', '#c87d46');
      document.documentElement.style.setProperty('--selection-bg', '#c87d46');
    }
  }, [theme]);

  const value: ThemeContextType = {
    theme,
    setTheme,
    isOcean: theme === 'ocean',
    isAutumn: theme === 'autumn',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
export default ThemeContext;
