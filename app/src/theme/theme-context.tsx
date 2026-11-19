import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_THEME, THEMES, isThemeId, type Palette, type ThemeId } from './themes';

const THEME_KEY = 'minitag.theme';

type ThemeContextValue = {
  themeId: ThemeId;
  palette: Palette;
  setTheme: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function loadTheme(): ThemeId {
  try {
    const saved = Storage.getItemSync(THEME_KEY);
    return isThemeId(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(loadTheme);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeId(id);
    try {
      Storage.setItemSync(THEME_KEY, id);
    } catch {
      // Not saved; the choice still applies until the app restarts.
    }
  }, []);

  const value = useMemo(
    () => ({ themeId, palette: THEMES[themeId].palette, setTheme }),
    [themeId, setTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used inside <AppThemeProvider>');
  return ctx;
}

export function usePalette(): Palette {
  return useAppTheme().palette;
}

/**
 * Styles that depend on the palette. Pass a module-level factory that returns
 * `StyleSheet.create({...})`; it is rebuilt only when the theme changes.
 */
export function useThemedStyles<T>(factory: (p: Palette) => T): T {
  const palette = usePalette();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(palette), [palette]);
}
