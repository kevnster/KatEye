import { StyleSheet } from 'react-native';

import type { ThemeColors } from '@/styles/app-theme';

export function createBottomNavStyles(c: ThemeColors) {
  return StyleSheet.create({
    screenPad: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
    },
    dock: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'stretch',
      paddingTop: 8,
      paddingHorizontal: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.tabDockBorder,
      backgroundColor: c.tabDockBg,
    },
    navItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 2,
      position: 'relative',
    },
    activeLineWrap: {
      position: 'absolute',
      top: 6,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    activeLine: {
      width: 48,
      height: 3,
      borderRadius: 2,
      backgroundColor: c.tabAccent,
      shadowColor: c.tabAccent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.55,
      shadowRadius: 6,
    },
    navLabel: {
      marginTop: 4,
      fontSize: 10,
      letterSpacing: 0.8,
      fontWeight: '700',
      textAlign: 'center',
    },
  });
}
