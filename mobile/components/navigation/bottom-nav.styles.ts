import { StyleSheet } from 'react-native';

import type { ThemeColors } from '@/styles/app-theme';

export function createBottomNavStyles(c: ThemeColors) {
  return StyleSheet.create({
    bottomNav: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      justifyContent: 'space-around',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      paddingTop: 10,
      paddingHorizontal: 12,
    },
    navItem: {
      minWidth: 72,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 6,
      borderRadius: 12,
    },
    navLabel: {
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
