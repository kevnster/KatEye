export type ImuSnapshot = {
  accel_x: number[];
  accel_y: number[];
  accel_z: number[];
  gyro_x: number[];
  gyro_y: number[];
  gyro_z: number[];
};

export const IMU_SERIES_KEYS = [
  'accel_x',
  'accel_y',
  'accel_z',
  'gyro_x',
  'gyro_y',
  'gyro_z',
] as const;

export type AlertEventRow = {
  eventKey: string;
  device_id: string;
  event_type: string;
  timestamp: number;
  snapshot: ImuSnapshot | null;
};

export const ALERTS_RTD_PATH = 'alerts' as const;

function numArr(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.map(Number).filter((n) => Number.isFinite(n));
}

export function normalizeAlertTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function parseImuSnapshot(raw: unknown): ImuSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const accel_x = numArr(s.accel_x);
  if (accel_x.length === 0) return null;
  return {
    accel_x,
    accel_y: numArr(s.accel_y),
    accel_z: numArr(s.accel_z),
    gyro_x: numArr(s.gyro_x),
    gyro_y: numArr(s.gyro_y),
    gyro_z: numArr(s.gyro_z),
  };
}

export function formatTimestampEst24h(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}

export function formatTimestampEstMmDdYyAnd24h(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const d = new Date(ms);
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'America/New_York' };
  const datePart = new Intl.DateTimeFormat('en-US', {
    ...opts,
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  }).format(d);
  const timePart = formatTimestampEst24h(ms);
  return `${datePart} ${timePart}`;
}

export function parseFixtureEventsMap(map: Record<string, unknown> | null): AlertEventRow[] {
  if (!map || typeof map !== 'object') return [];
  const rows: AlertEventRow[] = [];
  for (const [eventKey, raw] of Object.entries(map)) {
    if (eventKey.startsWith('_') || !raw || typeof raw !== 'object') continue;
    const e = raw as Record<string, unknown>;
    const snapshot = parseImuSnapshot(e.snapshot);
    if (!snapshot) continue;
    rows.push({
      eventKey,
      device_id: String(e.device_id ?? ''),
      event_type: String(e.event_type ?? ''),
      timestamp: normalizeAlertTimestamp(e.timestamp),
      snapshot,
    });
  }
  return rows.sort((a, b) => a.timestamp - b.timestamp);
}

function alertLabel(raw: Record<string, unknown>): string {
  const v =
    raw.event_type ?? raw.type ?? raw.title ?? raw.alert_type ?? raw.name ?? raw.category;
  return String(v ?? 'Alert');
}

function deviceIdFrom(raw: Record<string, unknown>): string {
  return String(
    raw.device_id ?? raw.package_id ?? raw.deviceId ?? raw.packageId ?? raw.unit_id ?? raw.sensor_id ?? '',
  ).trim();
}

// live rtdb rows may omit snapshot (fixture parse does not).
export function alertsMapToRows(map: Record<string, unknown> | null): AlertEventRow[] {
  if (!map || typeof map !== 'object') return [];
  const rows: AlertEventRow[] = [];
  for (const [eventKey, raw] of Object.entries(map)) {
    if (eventKey.startsWith('_') || !raw || typeof raw !== 'object') continue;
    const e = raw as Record<string, unknown>;
    const device_id = deviceIdFrom(e);
    if (!device_id) continue;
    const ts =
      normalizeAlertTimestamp(e.timestamp) ||
      normalizeAlertTimestamp(e.created_at) ||
      normalizeAlertTimestamp(e.time) ||
      normalizeAlertTimestamp(e.ts);
    rows.push({
      eventKey,
      device_id,
      event_type: alertLabel(e),
      timestamp: ts,
      snapshot: parseImuSnapshot(e.snapshot),
    });
  }
  return rows.sort((a, b) => a.timestamp - b.timestamp);
}
