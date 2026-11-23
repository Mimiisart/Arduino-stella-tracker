import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  DEFAULT_MODE,
  DEFAULT_THEME,
  THEMES,
  isModePreference,
  isThemeId,
  type ColorMode,
  type ModePreference,
  type Palette,
  type ThemeId,
} from './themes';

const THEME_KEY = 'minitag.theme';
const MODE_KEY = 'minitag.mode';

type ThemeContextValue = {
  themeId: ThemeId;
  modePreference: ModePreference; // what the user picked
  mode: ColorMode; // what is showing now
  palette: Palette;
  setTheme: (id: ThemeId) => void;
  setModePreference: (mode: ModePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function load<T>(key: string, isValid: (v: unknown) => v is T, fallback: T): T {
  try {
    const saved = Storage.getItemSync(key);
    return isValid(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: string) {
  try {
    Storage.setItemSync(key, value);
  } catch {
    // Not saved; the choice still applies until the app restarts.
  }
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(() => load(THEME_KEY, isThemeId, DEFAULT_THEME));
  const [modePreference, setModePref] = useState<ModePreference>(() => load(MODE_KEY, isModePreference, DEFAULT_MODE));
  const system = useColorScheme();
  const mode: ColorMode = modePreference === 'system' ? (system === 'dark' ? 'dark' : 'light') : modePreference;

  const setTheme = useCallback((id: ThemeId) => {
    setThemeId(id);
    save(THEME_KEY, id);
  }, []);

  const setModePreference = useCallback((m: ModePreference) => {
    setModePref(m);
    save(MODE_KEY, m);
  }, []);

  const value = useMemo(
    () => ({ themeId, modePreference, mode, palette: THEMES[themeId][mode], setTheme, setModePreference }),
    [themeId, modePreference, mode, setTheme, setModePreference],
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
