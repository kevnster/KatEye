import { StyleSheet } from 'react-native';

import type { ThemeColors } from '@/styles/app-theme';

export function createLandingStyles(c: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.pageBg,
    },
    background: {
      ...StyleSheet.absoluteFillObject,
    },
    glowTop: {
      position: 'absolute',
      top: -120,
      left: -80,
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: `${c.primary}14`,
    },
    glowBottom: {
      position: 'absolute',
      bottom: -140,
      right: -60,
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: `${c.liveDot}12`,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      gap: 28,
    },
    brandBlock: {
      alignItems: 'center',
      gap: 8,
    },
    brandTitle: {
      fontSize: 48,
      fontWeight: '800',
      letterSpacing: -1,
    },
    brandPrimary: {
      color: c.textPrimary,
    },
    brandAccent: {
      color: c.primary,
    },
    card: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 14,
      padding: 18,
      gap: 12,
    },
    cardTitle: {
      color: c.textPrimary,
      fontSize: 24,
      fontWeight: '700',
    },
    cardSubtitle: {
      color: c.textSecondary,
      fontSize: 13,
      marginBottom: 8,
    },
    primaryButton: {
      height: 48,
      borderRadius: 10,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
    },
    secondaryButton: {
      height: 48,
      borderRadius: 10,
      backgroundColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    secondaryButtonText: {
      color: c.textPrimary,
      fontWeight: '600',
      fontSize: 14,
    },
    helpButton: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    helpText: {
      color: c.textMuted,
      fontSize: 12,
    },
  });
}
