import { DarkTheme, DefaultTheme } from '@react-navigation/native';

import { darkColors, lightColors } from '@/styles/app-theme';

export const AppNavigationLight = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: lightColors.primary,
    background: lightColors.pageBg,
    card: lightColors.surface,
    text: lightColors.textPrimary,
    border: lightColors.border,
    notification: lightColors.danger,
  },
};

export const AppNavigationDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: darkColors.primary,
    background: darkColors.pageBg,
    card: darkColors.surface,
    text: darkColors.textPrimary,
    border: darkColors.border,
    notification: darkColors.danger,
  },
};
