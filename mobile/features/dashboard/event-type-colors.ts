import type { ThemeColors } from '@/styles/app-theme';

export function resolveEventTypeColor(eventType: string, colors: ThemeColors): string {
  const k = eventType.trim().toLowerCase();

  // Distinct, high-contrast tones for common driving events.
  if (k === 'alert') return '#EF4444';
  if (k.includes('impact')) return '#DC2626';

  if (k.includes('brake')) return '#F59E0B';
  if (k.includes('accelerat')) return '#EAB308';
  if (k.includes('turn') || k.includes(' left') || k.includes(' right') || k.endsWith('left') || k.endsWith('right'))
    return '#14B8A6';
  if (k.includes('swerve')) return '#3B82F6';
  if (k.includes('idle') || k.includes('idling')) return '#6B7280';

  const pool = ['#8B5CF6', '#22C55E', '#F97316', '#06B6D4', colors.textMuted] as const;
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h + k.charCodeAt(i) * (i + 17)) % 1_000_000;
  return pool[Math.abs(h) % pool.length]!;
}
