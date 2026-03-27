export type DashboardStat = {
  id: string;
  label: string;
  value: string;
  sub?: string;
  kind: 'value' | 'status';
  tone?: 'primary' | 'warning';
};

export type DashboardPackage = {
  id: string;
  name: string;
  location: string;
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

export type DashboardSnapshot = {
  teamLabel: string;
  heading: string;
  liveLink: string;
  stats: DashboardStat[];
  packages: DashboardPackage[];
  alerts: DashboardAlert[];
};
