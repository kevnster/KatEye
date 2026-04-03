import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { loadAlertEvents, subscribeAlertEvents, useRtdbFixtureMode } from '@/features/firebase/alerts-rtdb';
import type { AlertEventRow } from '@/features/firebase/event-rows';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

type AlertsEventsContextValue = {
  status: LoadStatus;
  events: AlertEventRow[];
  message: string | null;
  refresh: () => Promise<void>;
};

const AlertsEventsContext = createContext<AlertsEventsContextValue | null>(null);

export function AlertsEventsProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [events, setEvents] = useState<AlertEventRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setStatus('loading');
    setMessage(null);

    const unsubscribe = subscribeAlertEvents({
      onData: (rows) => {
        setEvents(rows);
        setStatus('ready');
        setMessage(
          useRtdbFixtureMode()
            ? 'Fixture · demo data'
            : `Live · alerts${rows.length ? ` (${rows.length})` : ''}`,
        );
      },
      onMissing: () => {
        setEvents([]);
        setStatus('ready');
        setMessage(useRtdbFixtureMode() ? 'Fixture · demo data' : 'alerts path empty');
      },
      onError: (msg) => {
        setStatus('error');
        setEvents([]);
        setMessage(msg);
      },
    });

    return unsubscribe;
  }, []);

  const refresh = useCallback(async () => {
    setStatus('loading');
    setMessage(null);
    const result = await loadAlertEvents();
    if (!result.ok) {
      setStatus('error');
      setEvents([]);
      setMessage(result.message);
      return;
    }
    setStatus('ready');
    setEvents(result.events);
    setMessage(result.source === 'fixture' ? 'Fixture · demo data' : 'Refreshed');
  }, []);

  const value = useMemo<AlertsEventsContextValue>(
    () => ({
      status,
      events,
      message,
      refresh,
    }),
    [status, events, message, refresh],
  );

  return <AlertsEventsContext.Provider value={value}>{children}</AlertsEventsContext.Provider>;
}

export function useAlertEvents(): AlertsEventsContextValue {
  const ctx = useContext(AlertsEventsContext);
  if (!ctx) {
    throw new Error('useAlertEvents must be used within AlertsEventsProvider');
  }
  return ctx;
}
