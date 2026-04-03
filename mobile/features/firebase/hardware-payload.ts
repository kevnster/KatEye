export type AccelSample = {
  x: number;
  y: number;
  z: number;
};

export type HardwareLogEvent = {
  ts: number;
  accel: AccelSample;
  anomaly?: boolean;
};

export function formatPackageIdTitle(packageId: string) {
  return packageId.replace(/_/g, '-').toUpperCase();
}
