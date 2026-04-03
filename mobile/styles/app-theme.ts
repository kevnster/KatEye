export type ThemeColors = {
  pageBg: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  success: string;
  warning: string;
  danger: string;
  liveDot: string;
  alertBorder: string;
  navActive: string;
  iconMuted: string;
  topBarIconBg: string;
  tabDockBg: string;
  tabDockBorder: string;
  tabAccent: string;
  tabInactive: string;
};

export const lightColors: ThemeColors = {
  pageBg: '#f5f2eb',
  surface: '#fffefb',
  border: '#e2dbd0',
  textPrimary: '#152226',
  textSecondary: '#3d524e',
  textMuted: '#6e807b',
  primary: '#9a7a3d',
  onPrimary: '#152226',
  success: '#3d6b5c',
  warning: '#c9a24a',
  danger: '#b45348',
  liveDot: '#c5a059',
  alertBorder: '#e8d4cf',
  navActive: '#e8e3d9',
  iconMuted: '#5c6e6a',
  topBarIconBg: '#ebe6dc',
  tabDockBg: '#fffefb',
  tabDockBorder: '#e2dbd0',
  tabAccent: '#9a7a3d',
  tabInactive: 'rgba(21,34,38,0.42)',
};

export const darkColors: ThemeColors = {
  pageBg: '#152226',
  surface: '#1a2e32',
  border: '#2a4046',
  textPrimary: '#f2efe8',
  textSecondary: '#bfc9c6',
  textMuted: '#7d908a',
  primary: '#c5a059',
  onPrimary: '#152226',
  success: '#7cb69d',
  warning: '#f0d080',
  danger: '#d4847a',
  liveDot: '#f0d080',
  alertBorder: '#4a3530',
  navActive: '#243a40',
  iconMuted: '#8a9d98',
  topBarIconBg: '#1e3338',
  tabDockBg: '#131e22',
  tabDockBorder: '#2a4046',
  tabAccent: '#c5a059',
  tabInactive: 'rgba(197,160,89,0.42)',
};

export const themeBase = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 14,
    xl: 20,
    pageBottomInset: 120,
  },
  radius: {
    sm: 8,
    md: 10,
    lg: 12,
    pill: 999,
  },
  fontSize: {
    xs: 8,
    sm: 9,
    md: 10,
    body: 12,
    titleSm: 14,
    title: 15,
    titleLg: 18,
    heading: 20,
    hero: 22,
  },
} as const;

export const withAlpha = (hexColor: string, alphaHex: string) => `${hexColor}${alphaHex}`;
