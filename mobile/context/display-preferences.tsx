import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type ClockFormat = '12h' | '24h';

type DisplayPreferencesContextValue = {
  clockFormat: ClockFormat;
  setClockFormat: (next: ClockFormat) => void;
};

const DisplayPreferencesContext = createContext<DisplayPreferencesContextValue | null>(null);

export function DisplayPreferencesProvider({ children }: { children: ReactNode }) {
  const [clockFormat, setClockFormat] = useState<ClockFormat>('24h');

  const value = useMemo<DisplayPreferencesContextValue>(
    () => ({ clockFormat, setClockFormat }),
    [clockFormat],
  );

  return <DisplayPreferencesContext.Provider value={value}>{children}</DisplayPreferencesContext.Provider>;
}

export function useDisplayPreferences(): DisplayPreferencesContextValue {
  const ctx = useContext(DisplayPreferencesContext);
  if (!ctx) throw new Error('useDisplayPreferences must be used within DisplayPreferencesProvider');
  return ctx;
}

