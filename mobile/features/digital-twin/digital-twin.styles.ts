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
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.pageBottomInset,
    },

    heroRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
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
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: `${c.primary}18`,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primary}40`,
    },
    liveBadgeOffline: {
      backgroundColor: `${c.border}35`,
      borderColor: `${c.border}55`,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.success,
    },
    liveDotOffline: {
      backgroundColor: c.textMuted,
    },
    liveText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: c.primary,
      textTransform: 'uppercase',
    },
    liveTextOffline: {
      color: c.textMuted,
    },

    twinSection: {
      marginTop: t.spacing.sm,
      aspectRatio: 1,
      width: '100%',
      borderRadius: t.radius.lg,
      overflow: 'hidden',
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.border}99`,
    },
    twinMapCard: {
      width: '100%',
      height: 160,
      borderRadius: t.radius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    twinMap: {
      width: '100%',
      height: '100%',
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

    pingButton: {
      marginTop: t.spacing.lg,
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
      color: c.onPrimary,
    },

    lastUpdatedRow: {
      marginTop: t.spacing.sm,
      flexDirection: 'row',
      flexWrap: 'nowrap',
      alignItems: 'baseline',
      gap: 8,
      minWidth: 0,
    },
    lastUpdatedLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 2,
      color: c.tabAccent,
      opacity: 0.75,
      textTransform: 'uppercase',
    },
    lastUpdatedValue: {
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    sectionGap: {
      marginTop: t.spacing.md,
    },
    sectionTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
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
      paddingVertical: t.spacing.sm,
      paddingHorizontal: 8,
      borderTopWidth: 2,
      borderTopColor: `${c.primary}22`,
      backgroundColor: c.surface,
      borderRadius: 2,
    },
    metricLabel: {
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 2,
      marginBottom: 4,
      color: c.primary,
      textTransform: 'uppercase',
    },
    metricLabelSecondary: {
      color: glow,
    },
    metricValue: {
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: -0.5,
      color: c.textPrimary,
    },

    ledgerTime: {
      fontSize: 10,
      fontFamily: 'monospace',
      color: c.textMuted,
      letterSpacing: 1,
      marginTop: 2,
    },

    screenMetaHint: {
      fontSize: 11,
      color: c.textMuted,
      marginBottom: t.spacing.sm,
    },
    telemetryLogCard: {
      backgroundColor: c.surface,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: t.spacing.md,
      gap: t.spacing.xs,
    },
    telemetryLogRow: {
      paddingVertical: t.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      gap: 4,
    },
    telemetryLogRowFirst: {
      borderTopWidth: 0,
      paddingTop: 0,
    },
    telemetryLogRowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
    },
    telemetryLogMainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    },
    telemetryLogInfoCol: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    telemetryLogMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 6,
      width: '100%',
      minWidth: 0,
    },
    telemetryLogToggleBtn: {
      marginLeft: 2,
      padding: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    telemetryLogToggleText: {
      flex: 1,
      minWidth: 0,
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'monospace',
    },
    telemetryLogTimeRange: {
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      fontWeight: '700',
      color: c.textPrimary,
    },
    telemetryLogNominal: {
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
      color: c.textMuted,
    },
    telemetryLogEvents: {
      flex: 1,
      minWidth: 0,
      fontSize: 11,
      color: c.textMuted,
      fontFamily: 'monospace',
    },
    telemetryLogExpand: {
      marginTop: 2,
      paddingTop: 8,
      paddingBottom: 2,
      paddingLeft: 8,
      gap: 6,
      borderLeftWidth: 2,
      borderLeftColor: `${c.primary}44`,
    },
    telemetryLogExpandEmpty: {
      fontSize: 10,
      color: c.textMuted,
      fontStyle: 'italic',
      lineHeight: 14,
    },
    telemetryLogExpandMeta: {
      fontSize: 9,
      fontWeight: '700',
      color: c.textMuted,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    telemetryLogExpandBlock: {
      gap: 2,
    },
    telemetryLogExpandCaption: {
      fontSize: 9,
      fontWeight: '800',
      color: c.primary,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    telemetryLogExpandNums: {
      fontSize: 10,
      fontFamily: 'monospace',
      color: c.textSecondary,
      lineHeight: 14,
    },
  });
}

export type DigitalTwinStyles = ReturnType<typeof createDigitalTwinStyles>;
