import { StyleSheet } from 'react-native';

import type { ThemeColors } from '@/styles/app-theme';

export function createSimpleTabScreenStyles(c: ThemeColors) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: c.pageBg,
    },
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: c.textPrimary,
    },
    subtitle: {
      marginTop: 8,
      fontSize: 16,
      color: c.textMuted,
      textAlign: 'center',
    },
  });
}
