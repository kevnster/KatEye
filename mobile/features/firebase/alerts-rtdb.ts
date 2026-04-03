import { get, onValue, ref } from 'firebase/database';

import alertsFixture from '../../../firebase-rtdb-alerts.fixture.json';

import { rtdb } from '@/features/firebase/client';
import {
  ALERTS_RTD_PATH,
  alertsMapToRows,
  parseFixtureEventsMap,
  type AlertEventRow,
} from '@/features/firebase/event-rows';

export function useRtdbFixtureMode(): boolean {
  if (process.env.EXPO_PUBLIC_RTD_USE_FIXTURE === '1') return true;
  return !process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL?.trim();
}

export function getFixtureAlertEvents(): AlertEventRow[] {
  return parseFixtureEventsMap(alertsFixture as Record<string, unknown>);
}

export type LoadAlertEventsResult =
  | { ok: true; source: 'fixture' | 'rtdb'; events: AlertEventRow[] }
  | { ok: false; source: 'fixture' | 'rtdb'; message: string };

export async function loadAlertEvents(): Promise<LoadAlertEventsResult> {
  if (useRtdbFixtureMode()) {
    try {
      return { ok: true, source: 'fixture', events: getFixtureAlertEvents() };
    } catch (e) {
      return {
        ok: false,
        source: 'fixture',
        message: e instanceof Error ? e.message : 'fixture load failed',
      };
    }
  }
  try {
    const snapshot = await get(ref(rtdb, ALERTS_RTD_PATH));
    if (!snapshot.exists()) return { ok: true, source: 'rtdb', events: [] };
    return {
      ok: true,
      source: 'rtdb',
      events: alertsMapToRows(snapshot.val() as Record<string, unknown>),
    };
  } catch (e) {
    return {
      ok: false,
      source: 'rtdb',
      message: e instanceof Error ? e.message : 'rtdb error',
    };
  }
}

export type AlertEventsHandlers = {
  onData: (events: AlertEventRow[]) => void;
  onMissing?: () => void;
  onError?: (message: string) => void;
};

export function subscribeAlertEvents(handlers: AlertEventsHandlers): () => void {
  if (useRtdbFixtureMode()) {
    try {
      handlers.onData(getFixtureAlertEvents());
    } catch (e) {
      handlers.onError?.(e instanceof Error ? e.message : 'fixture load failed');
    }
    return () => {};
  }
  return onValue(
    ref(rtdb, ALERTS_RTD_PATH),
    (snapshot) => {
      if (!snapshot.exists()) {
        handlers.onMissing?.();
        return;
      }
      handlers.onData(alertsMapToRows(snapshot.val() as Record<string, unknown>));
    },
    (err) => handlers.onError?.(err.message),
  );
}
