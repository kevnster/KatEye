import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { darkColors, lightColors, type ThemeColors } from '@/styles/app-theme';

const key = '@kateye/theme-pref';

export type ThemePreference = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  pref: ThemePreference;
  setPref: (p: ThemePreference) => void;
  scheme: 'light' | 'dark';
  colors: ThemeColors;
  // tap sun/moon — pin to opposite of whatever youre seeing (overrides system)
  toggleLightDark: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolvedScheme(pref: ThemePreference, system: 'light' | 'dark' | null | undefined): 'light' | 'dark' {
  if (pref === 'system') return system === 'dark' ? 'dark' : 'light';
  return pref;
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useSystemColorScheme();
  const [pref, setPrefState] = useState<ThemePreference>('system');

  useEffect(() => {
    void AsyncStorage.getItem(key).then((raw) => {
      if (raw === 'light' || raw === 'dark' || raw === 'system') setPrefState(raw);
    });
  }, []);

  const setPref = useCallback((p: ThemePreference) => {
    setPrefState(p);
    void AsyncStorage.setItem(key, p);
  }, []);

  const scheme = useMemo(() => resolvedScheme(pref, system), [pref, system]);
  const colors = scheme === 'dark' ? darkColors : lightColors;

  const toggleLightDark = useCallback(() => {
    const next: 'light' | 'dark' = scheme === 'dark' ? 'light' : 'dark';
    setPref(next);
  }, [scheme, setPref]);

  const value = useMemo(
    () => ({ pref, setPref, scheme, colors, toggleLightDark }),
    [pref, setPref, scheme, colors, toggleLightDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('useAppTheme needs AppThemeProvider');
  return v;
}
