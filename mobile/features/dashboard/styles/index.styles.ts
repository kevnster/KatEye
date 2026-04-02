import { StyleSheet } from 'react-native';

import type { ThemeColors } from '@/styles/app-theme';
import { themeBase as t } from '@/styles/app-theme';

export function createDashboardStyles(c: ThemeColors) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: c.pageBg,
    },
    content: {
      paddingHorizontal: t.spacing.xl,
      paddingTop: 16,
      paddingBottom: t.spacing.pageBottomInset,
      gap: t.spacing.lg,
    },
    testCard: {
      backgroundColor: c.surface,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: t.spacing.md,
      gap: t.spacing.sm,
    },
    testHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    testTitle: {
      fontSize: t.fontSize.titleSm,
      color: c.textPrimary,
      fontWeight: '700',
    },
    testStatus: {
      fontSize: t.fontSize.md,
      fontWeight: '800',
      color: c.textMuted,
    },
    testStatusOk: {
      color: c.success,
    },
    testStatusFail: {
      color: c.danger,
    },
    testMessage: {
      fontSize: t.fontSize.body,
      color: c.textSecondary,
    },
    testButton: {
      alignSelf: 'flex-start',
      backgroundColor: c.primary,
      borderRadius: t.radius.sm,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
    },
    testButtonText: {
      color: c.surface,
      fontSize: 12,
      fontWeight: '700',
    },
    payloadText: {
      marginTop: t.spacing.xs,
      fontSize: 11,
      color: c.textPrimary,
      backgroundColor: c.pageBg,
      borderRadius: t.radius.sm,
      padding: t.spacing.sm,
      fontFamily: 'monospace',
    },
    heroRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: 12,
    },
    heading: {
      marginTop: 2,
      fontSize: t.fontSize.hero,
      fontWeight: '800',
      color: c.textPrimary,
    },
    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: t.fontSize.md,
      paddingVertical: 6,
      borderRadius: t.radius.md,
      backgroundColor: c.border,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.liveDot,
    },
    liveText: {
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color: c.textSecondary,
      fontWeight: '600',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 10,
    },
    statCard: {
      width: '31%',
      minWidth: 104,
      backgroundColor: c.surface,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: t.spacing.md,
      paddingVertical: 10,
    },
    statLabel: {
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color: c.textMuted,
      fontWeight: '600',
    },
    statValueRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '900',
    },
    statSub: {
      marginTop: 3,
      color: c.textMuted,
      fontSize: 8,
    },
    sectionHeader: {
      marginTop: 4,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: t.fontSize.heading,
      color: c.textPrimary,
      fontWeight: '800',
    },
    sectionAction: {
      color: c.primary,
      fontSize: 12,
      fontWeight: '600',
    },
    packagesWrap: {
      gap: 10,
    },
    packageCard: {
      backgroundColor: c.surface,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: t.spacing.lg,
      gap: 10,
    },
    packageMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    packageIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    packageName: {
      fontSize: 16,
      color: c.textPrimary,
      fontWeight: '700',
    },
    packageId: {
      marginTop: 2,
      color: c.textMuted,
      fontSize: 12,
    },
    packageMeta: {
      gap: 6,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    locationText: {
      color: c.textSecondary,
      fontSize: 12,
    },
    progressTrack: {
      height: 6,
      borderRadius: t.radius.sm,
      backgroundColor: c.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
    },
    damageText: {
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: c.textMuted,
      fontWeight: '700',
    },
    packageRight: {
      marginTop: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statusPill: {
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: t.radius.pill,
      overflow: 'hidden',
    },
    alertCard: {
      marginTop: 2,
      backgroundColor: c.surface,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: c.alertBorder,
      padding: t.spacing.lg,
      gap: 10,
    },
    alertHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    alertTitle: {
      fontSize: 18,
      color: c.textPrimary,
      fontWeight: '800',
    },
    alertItem: {
      borderLeftWidth: 2,
      paddingLeft: 10,
      gap: 4,
    },
    alertType: {
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 1,
      fontWeight: '800',
    },
    alertMessage: {
      fontSize: 14,
      color: c.textPrimary,
      lineHeight: 20,
    },
    alertTime: {
      fontSize: 11,
      color: c.textMuted,
      textTransform: 'uppercase',
    },
    mapCard: {
      backgroundColor: c.surface,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    mapView: {
      height: 170,
    },
    mapFooter: {
      padding: t.spacing.md,
    },
    mapTitle: {
      color: c.textPrimary,
      fontSize: t.fontSize.title,
      fontWeight: '700',
    },
    mapSub: {
      marginTop: 2,
      color: c.textMuted,
      fontSize: 12,
    },
  });
}
