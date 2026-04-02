import { StyleSheet } from 'react-native';

import type { ThemeColors } from '@/styles/app-theme';
import { themeBase as t } from '@/styles/app-theme';

export function createDigitalTwinStyles(c: ThemeColors) {
  const tertiary = c.warning;
  const glow = c.tabAccent;

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.pageBg,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: t.spacing.xl,
      paddingTop: t.spacing.md,
      paddingBottom: t.spacing.pageBottomInset,
    },

    heroRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: t.spacing.sm,
    },
    heroLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 3.2,
      color: c.tabAccent,
      opacity: 0.65,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    heroTitle: {
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: -1,
      color: c.textPrimary,
      fontStyle: 'italic',
      textTransform: 'uppercase',
    },

    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: `${c.primary}18`,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primary}35`,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: glow,
    },
    liveText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 2,
      color: c.primary,
      textTransform: 'uppercase',
    },

    twinSection: {
      marginTop: t.spacing.xl,
      aspectRatio: 1,
      width: '100%',
      borderRadius: t.radius.lg,
      overflow: 'hidden',
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.border}99`,
    },
    twinSectionInner: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    twinDepth: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.4,
      backgroundColor: c.pageBg,
    },
    twinCrossV: {
      position: 'absolute',
      left: '50%',
      top: 0,
      bottom: 0,
      width: StyleSheet.hairlineWidth * 2,
      marginLeft: -StyleSheet.hairlineWidth,
      backgroundColor: `${c.primary}35`,
    },
    twinCrossH: {
      position: 'absolute',
      top: '50%',
      left: 0,
      right: 0,
      height: StyleSheet.hairlineWidth * 2,
      marginTop: -StyleSheet.hairlineWidth,
      backgroundColor: `${c.primary}35`,
    },
    twinFrame: {
      width: 192,
      height: 192,
      borderRadius: t.radius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: `${c.primary}45`,
    },
    twinImage: {
      width: '100%',
      height: '100%',
      opacity: 0.85,
    },
    scanClip: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: t.radius.md,
      overflow: 'hidden',
      pointerEvents: 'none',
    },
    scanLine: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: glow,
      opacity: 0.95,
    },

    orientTag: {
      position: 'absolute',
      bottom: t.spacing.md,
      left: t.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: t.spacing.md,
      paddingVertical: 7,
      borderRadius: 4,
      backgroundColor: `${c.surface}DD`,
      borderLeftWidth: 2,
      borderLeftColor: c.primary,
    },
    orientLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: c.primary,
      opacity: 0.85,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    orientValue: {
      fontSize: 10,
      fontFamily: 'monospace',
      color: c.textPrimary,
    },

    pingButton: {
      marginTop: t.spacing.xl,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: t.spacing.xl,
      borderRadius: 4,
      backgroundColor: c.primary,
    },
    pingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
    },
    pingLabel: {
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 2,
      color: '#FFFFFF',
    },

    sectionGap: {
      marginTop: t.spacing.xl,
    },
    sectionTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: t.spacing.md,
    },
    sectionTitleBar: {
      width: 8,
      height: 2,
      backgroundColor: glow,
    },
    sectionTitleBarWarn: {
      backgroundColor: tertiary,
    },
    sectionTitleText: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 2.4,
      color: c.textMuted,
      textTransform: 'uppercase',
    },

    metricsRow: {
      flexDirection: 'row',
      gap: t.spacing.sm,
    },
    metricCard: {
      flex: 1,
      padding: t.spacing.md,
      borderTopWidth: 2,
      borderTopColor: `${c.primary}22`,
      backgroundColor: c.surface,
      borderRadius: 2,
    },
    metricLabel: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 3,
      marginBottom: 6,
      color: c.primary,
      textTransform: 'uppercase',
    },
    metricLabelSecondary: {
      color: glow,
    },
    metricValue: {
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.5,
      color: c.textPrimary,
    },

    ledgerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: t.spacing.md,
    },
    ledgerUptime: {
      fontSize: 9,
      fontFamily: 'monospace',
      color: c.iconMuted,
    },
    ledgerBox: {
      borderRadius: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.border}66`,
      overflow: 'hidden',
    },
    ledgerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: t.spacing.md,
    },
    ledgerRowBg: {
      backgroundColor: c.pageBg,
    },
    ledgerRowBgAlt: {
      backgroundColor: c.surface,
    },
    ledgerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      flex: 1,
    },
    ledgerDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    ledgerTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: c.textPrimary,
    },
    ledgerTitleCritical: {
      color: tertiary,
    },
    ledgerTime: {
      fontSize: 10,
      fontFamily: 'monospace',
      color: c.textMuted,
      letterSpacing: 1,
      marginTop: 2,
    },
    ledgerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    ledgerExtra: {
      fontSize: 10,
      fontWeight: '800',
      color: tertiary,
    },
  });
}
