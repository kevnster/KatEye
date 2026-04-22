import { formatPackageIdTitle } from '@/features/firebase/hardware-payload';
import { formatTimestampEst24h, type AlertEventRow } from '@/features/firebase/event-rows';
import { nearbyLocationLabel, syntheticCoordForDevice } from '@/features/map/nearby-location';
import type { ThemeColors } from '@/styles/app-theme';
import type {
  DashboardAlert,
  DashboardPackage,
  DashboardStat,
  EventTypeSlice,
  FleetActivityModel,
  FleetHourBucket,
  FleetActivityTick,
  PackageDashboardView,
} from '@/features/dashboard/types';

export type { PackageDashboardView };

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export type BuildFleetDashboardOptions = {
  nowMs?: number;
  use12h?: boolean;
};

export function createDashboardPalette(colors: ThemeColors) {
  return {
    statValueColor(stat: DashboardStat) {
      if (stat.kind === 'status') return colors.textPrimary;
      if (stat.tone === 'warning') return colors.warning;
      return colors.primary;
    },
    packageAccent(status: DashboardPackage['status']) {
      if (status === 'impact_detected') return colors.warning;
      if (status === 'warning') return colors.danger;
      return colors.primary;
    },
    packageStatusLabel(status: DashboardPackage['status']) {
      if (status === 'impact_detected') return 'Critical';
      if (status === 'warning') return 'Anomaly';
      return 'Nominal';
    },
    alertAccent(level: 'critical' | 'warning') {
      if (level === 'critical') return colors.danger;
      return colors.warning;
    },
  };
}

function formatIso(ts: number) {
  return new Date(ts).toISOString();
}

function formatRelativeSince(nowMs: number, ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return '—';
  const d = Math.max(0, nowMs - ts);
  const sec = Math.floor(d / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function statusFromEventType(eventType: string): DashboardPackage['status'] {
  const t = eventType.toLowerCase();
  if (t.includes('impact')) return 'impact_detected';
  if (t.includes('aggressive') || t.includes('sharp') || t.includes('swerve')) return 'warning';
  return 'safe';
}

function groupByDevice(events: AlertEventRow[]): Map<string, AlertEventRow[]> {
  const m = new Map<string, AlertEventRow[]>();
  for (const e of events) {
    const id = e.device_id.trim() || 'unknown';
    if (!m.has(id)) m.set(id, []);
    m.get(id)!.push(e);
  }
  for (const rows of m.values()) {
    rows.sort((a, b) => a.timestamp - b.timestamp);
  }
  return m;
}

function buildHourBuckets(
  events: AlertEventRow[],
  windowStartMs: number,
  windowEndMs: number,
): FleetHourBucket[] {
  const span = windowEndMs - windowStartMs;
  const buckets: FleetHourBucket[] = [];
  for (let index = 0; index < 24; index += 1) {
    const bucketStart = windowStartMs + (index / 24) * span;
    const bucketEnd = windowStartMs + ((index + 1) / 24) * span;
    const evs =
      index === 23
        ? events.filter((e) => e.timestamp >= bucketStart && e.timestamp <= windowEndMs)
        : events.filter((e) => e.timestamp >= bucketStart && e.timestamp < bucketEnd);
    const deviceIds = [...new Set(evs.map((e) => e.device_id.trim() || 'unknown'))];
    buckets.push({ index, count: evs.length, deviceIds });
  }
  return buckets;
}

function buildActivity(
  events: AlertEventRow[],
  windowStartMs: number,
  windowEndMs: number,
): FleetActivityModel {
  const span = Math.max(1, windowEndMs - windowStartMs);
  const inWindow = (t: number) => t >= windowStartMs && t <= windowEndMs;
  const eventsInWindow = events.filter((e) => inWindow(e.timestamp));
  const ticks: FleetActivityTick[] = eventsInWindow
    .map((e) => ({
      eventKey: e.eventKey,
      timestamp: e.timestamp,
      deviceId: e.device_id.trim() || 'unknown',
      x: (e.timestamp - windowStartMs) / span,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
  return {
    windowStartMs,
    windowEndMs,
    ticks,
    hourBuckets: buildHourBuckets(events, windowStartMs, windowEndMs),
  };
}

function buildEventMix(events: AlertEventRow[], eventsLast24: AlertEventRow[]): EventTypeSlice[] {
  const mixSource = eventsLast24.length > 0 ? eventsLast24 : events;
  const typeCounts = new Map<string, number>();
  for (const e of mixSource) {
    const k = e.event_type.trim() || 'Unknown';
    typeCounts.set(k, (typeCounts.get(k) ?? 0) + 1);
  }
  const total = mixSource.length;
  return [...typeCounts.entries()]
    .map(([eventType, count]) => ({
      eventType,
      count,
      fraction: total > 0 ? count / total : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function buildFleetDashboard(
  events: AlertEventRow[],
  options?: BuildFleetDashboardOptions,
): PackageDashboardView | null {
  if (events.length === 0) return null;

  const nowMs = options?.nowMs ?? Date.now();
  const use12h = options?.use12h ?? false;
  const windowEndMs = nowMs;
  const windowStartMs = nowMs - DAY_MS;

  const inLast24 = (t: number) => t >= windowStartMs && t <= windowEndMs;

  const eventsLast24 = events.filter((e) => inLast24(e.timestamp));

  const byDevice = groupByDevice(events);
  const deviceIds = [...byDevice.keys()].sort();

  const packages: DashboardPackage[] = deviceIds.map((id) => {
    const rows = byDevice.get(id)!;
    const latest = rows[rows.length - 1]!;
    const first = rows[0]!;
    const coord =
      latest.latitude != null && latest.longitude != null
        ? { latitude: latest.latitude, longitude: latest.longitude }
        : syntheticCoordForDevice(id);
    return {
      id,
      name: formatPackageIdTitle(id),
      locationLabel: nearbyLocationLabel(coord),
      lastEventType: latest.event_type,
      lastEventRelative: formatRelativeSince(nowMs, latest.timestamp),
      firstEventType: first.event_type,
      firstEventRelative: formatRelativeSince(nowMs, first.timestamp),
      score: String(rows.length),
      status: statusFromEventType(latest.event_type),
    };
  });

  const alerts: DashboardAlert[] = events
    .filter((e) => e.event_type.toLowerCase().includes('impact'))
    .map((e) => ({
      id: e.eventKey,
      type: e.event_type,
      message: e.device_id,
      time: formatIso(e.timestamp),
      level: 'critical' as const,
    }));

  const latestTs = Math.max(...events.map((e) => e.timestamp));

  const stats: DashboardStat[] = [
    {
      id: 'devices',
      label: 'Devices',
      value: String(deviceIds.length),
      kind: 'value',
      tone: 'primary',
    },
    {
      id: 'events',
      label: 'Events',
      value: String(events.length),
      kind: 'value',
      tone: 'primary',
    },
    {
      id: 'latest',
      label: 'Last alert',
      value: latestTs ? formatTimestampEst24h(latestTs, use12h) : '—',
      kind: 'value',
    },
  ];

  return {
    stats,
    packages,
    alerts,
    activity: buildActivity(events, windowStartMs, windowEndMs),
    eventMix: buildEventMix(events, eventsLast24),
  };
}
