import type { DashboardSnapshot } from '@/features/dashboard/types';

export const dashboardMockData: DashboardSnapshot = {
  teamLabel: 'Team Kat - POC Phase 1',
  heading: 'Fleet Overview',
  liveLink: 'System Live: Link-04',
  stats: [
    {
      id: 'active-shipments',
      label: 'Active Shipments',
      value: '03',
      sub: 'Units In Transit',
      kind: 'value',
      tone: 'primary',
    },
    {
      id: 'damage-score',
      label: 'Total Score',
      value: '0.12',
      sub: 'G-Force Avg',
      kind: 'value',
      tone: 'warning',
    },
    {
      id: 'fleet-status',
      label: 'Global Fleet Status',
      value: 'Secure',
      kind: 'status',
    },
  ],
  packages: [
    {
      id: 'KAT-0091-AX',
      name: 'Package Alpha',
      location: 'In Transit: Los Angeles',
      score: '0.04',
      status: 'safe',
    },
    {
      id: 'KAT-0042-BY',
      name: 'Package Beta',
      location: 'Docking: San Francisco',
      score: '0.28',
      status: 'impact_detected',
    },
  ],
  alerts: [
    {
      id: 'critical-gforce',
      type: 'Critical Event',
      message: 'Critical G-Force spike in Zone 4B detected on Package Beta.',
      time: '2 minutes ago',
      level: 'critical',
    },
    {
      id: 'temp-flux',
      type: 'Temperature Flux',
      message: 'Package Alpha temperature rose +2C above threshold.',
      time: '14 minutes ago',
      level: 'warning',
    },
  ],
};
