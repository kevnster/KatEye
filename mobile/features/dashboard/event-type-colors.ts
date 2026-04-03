import type { ThemeColors } from '@/styles/app-theme';

export function resolveEventTypeColor(eventType: string, colors: ThemeColors): string {
  const k = eventType.trim().toLowerCase();

  if (k === 'alert') return colors.danger;
  if (k.includes('impact')) return colors.danger;

  if (k.includes('brake')) return colors.primary;
  if (k.includes('accelerat')) return colors.warning;
  if (k.includes('turn') || k.includes(' left') || k.includes(' right') || k.endsWith('left') || k.endsWith('right'))
    return colors.success;
  if (k.includes('swerve')) return colors.navActive;

  const pool = [colors.primary, colors.warning, colors.success, colors.navActive, colors.textMuted] as const;
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h + k.charCodeAt(i) * (i + 17)) % 1_000_000;
  return pool[Math.abs(h) % pool.length]!;
}
