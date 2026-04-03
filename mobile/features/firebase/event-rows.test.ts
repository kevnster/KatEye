import alertsFixture from '../../../firebase-rtdb-alerts.fixture.json';

import { buildFleetDashboard } from '@/features/dashboard/package-dashboard-model';
import {
  alertsMapToRows,
  IMU_SERIES_KEYS,
  formatTimestampEst24h,
  formatTimestampEstMmDdYyAnd24h,
  parseFixtureEventsMap,
} from '@/features/firebase/event-rows';

function demoRows() {
  return parseFixtureEventsMap(alertsFixture as Record<string, unknown>);
}

describe('alerts fixture (firebase-rtdb-alerts.fixture.json)', () => {
  it('parses rtdb-shaped alerts map to rows', () => {
    const keys = Object.keys(alertsFixture as Record<string, unknown>).filter((k) => !k.startsWith('_'));
    expect(demoRows()).toHaveLength(keys.length);
    expect(demoRows()).toHaveLength(7);
  });

  it('rows have six IMU series', () => {
    for (const row of demoRows()) {
      expect(row.snapshot).not.toBeNull();
      const snap = row.snapshot!;
      for (const k of IMU_SERIES_KEYS) {
        expect(Array.isArray(snap[k])).toBe(true);
      }
      expect(snap.accel_x.length).toBeGreaterThan(0);
    }
  });

  it('formats EST time', () => {
    expect(formatTimestampEst24h(1743601200000)).toMatch(/^\d{1,2}:\d{2}:\d{2}$/);
  });

  it('formats EST date MM/DD/YY plus 24h time', () => {
    expect(formatTimestampEstMmDdYyAnd24h(1743601200000)).toMatch(
      /^\d{1,2}\/\d{1,2}\/\d{2} \d{1,2}:\d{2}:\d{2}$/,
    );
  });

  it('buildFleetDashboard groups demo json by device_id', () => {
    const rows = parseFixtureEventsMap(alertsFixture as Record<string, unknown>);
    const view = buildFleetDashboard(rows, { nowMs: 1_743_610_000_000 });
    expect(view).not.toBeNull();
    expect(view!.packages.length).toBeGreaterThanOrEqual(1);
    expect(view!.activity.ticks.length).toBeGreaterThan(0);
    expect(view!.eventMix.length).toBeGreaterThan(0);
    expect(view!.packages[0]?.lastEventRelative).toBeTruthy();
  });
});

describe('alertsMapToRows', () => {
  it('maps flexible fields and keeps rows without IMU snapshot', () => {
    const rows = alertsMapToRows({
      a1: {
        package_id: 'pkg-1',
        type: 'Brake',
        timestamp: 1000,
      },
      a2: {
        device_id: 'dev-2',
        title: 'Bump',
        created_at: 2000,
        snapshot: {
          accel_x: [0.1],
          accel_y: [9.8],
          accel_z: [0],
          gyro_x: [0],
          gyro_y: [0],
          gyro_z: [0],
        },
      },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].device_id).toBe('pkg-1');
    expect(rows[0].snapshot).toBeNull();
    expect(rows[1].snapshot).not.toBeNull();
  });

  it('skips entries without device / package id', () => {
    expect(alertsMapToRows({ x: { timestamp: 1 } })).toHaveLength(0);
  });
});
