export type DashboardStat = {
  id: string;
  label: string;
  value: string;
  kind: 'value' | 'status';
  tone?: 'primary' | 'warning';
};

export type FleetActivityTick = {
  eventKey: string;
  timestamp: number;
  deviceId: string;
  x: number;
};

export type FleetHourBucket = {
  index: number;
  count: number;
  deviceIds: string[];
};

export type FleetActivityModel = {
  windowStartMs: number;
  windowEndMs: number;
  ticks: FleetActivityTick[];
  hourBuckets: FleetHourBucket[];
};

export type EventTypeSlice = {
  eventType: string;
  count: number;
  fraction: number;
};

export type DashboardPackage = {
  id: string;
  name: string;
  lastEventType: string;
  lastEventRelative: string;
  firstEventType: string;
  firstEventRelative: string;
  score: string;
  status: 'safe' | 'impact_detected' | 'warning';
};

export type DashboardAlert = {
  id: string;
  type: string;
  message: string;
  time: string;
  level: 'critical' | 'warning';
};

export type PackageDashboardView = {
  stats: DashboardStat[];
  packages: DashboardPackage[];
  alerts: DashboardAlert[];
  activity: FleetActivityModel;
  eventMix: EventTypeSlice[];
};
