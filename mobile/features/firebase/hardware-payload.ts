// firebase rtdb shapes for one package + time windows.
// firebase-rtdb-schema-example.json is fake data (console import / bundled fixture) — not live hw.
// npm run test — jest asserts fixture shape. npm run start:fixture — app uses that json, skips rtdb.

export type AccelSample = {
  x: number;
  y: number;
  z: number;
};

// single accel reading inside a window
export type HardwareLogEvent = {
  ts: number;
  accel: AccelSample;
  // optional flag if detector fired on this sample
  anomaly?: boolean;
};

// one 15s (or whatever) slice under packages/x/readings/{key}
// isCritical false -> usually one "alive" ping in events
// isCritical true -> multiple samples (incident / burst)
// events is a map on purpose (rtdb hates arrays for this)
// readings key + batchId: `${startMs}_${endMs}` — see hardwareWindowBatchId()
export type HardwareReadingWindow = {
  batchId?: string;
  windowStartTs: number;
  windowEndTs: number;
  // e.g. 15000
  windowDurationMs: number;
  isCritical: boolean;
  events: Record<string, HardwareLogEvent>;
};

// what's at packages/{packageId} — id is the path segment, not a field on the obj
// latest = copy of newest window for cheap listeners
export type HardwarePackageNode = {
  latest: HardwareReadingWindow;
  readings: Record<string, HardwareReadingWindow>;
};

// example rtdb path + id (json under repo root uses packages/{id})
export const EXAMPLE_PACKAGE_ID = 'pkg_schema_example' as const;
export const EXAMPLE_PACKAGE_RTD_PATH = `packages/${EXAMPLE_PACKAGE_ID}` as const;

export function hardwareWindowBatchId(windowStartTs: number, windowEndTs: number): string {
  return `${windowStartTs}_${windowEndTs}`;
}
