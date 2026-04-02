// shared tokens — createXStyles(c) wired from context

export type ThemeColors = {
  pageBg: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  success: string;
  warning: string;
  danger: string;
  liveDot: string;
  alertBorder: string;
  navActive: string;
  iconMuted: string;
  topBarIconBg: string;
};

// default light
export const lightColors: ThemeColors = {
  pageBg: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  primary: '#2563EB',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#DC2626',
  liveDot: '#10B981',
  alertBorder: '#FECACA',
  navActive: '#E5E7EB',
  iconMuted: '#6B7280',
  topBarIconBg: '#F3F4F6',
};

export const darkColors: ThemeColors = {
  pageBg: '#0F172A',
  surface: '#1E293B',
  border: '#334155',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  primary: '#60A5FA',
  success: '#22C55E',
  warning: '#FBBF24',
  danger: '#F87171',
  liveDot: '#34D399',
  alertBorder: '#7F1D1D',
  navActive: '#334155',
  iconMuted: '#9CA3AF',
  topBarIconBg: '#334155',
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
