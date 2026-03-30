export const AppTheme = {
  colors: {
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
  },
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

export const withAlpha = (hexColor: string, alphaHex: string) => {
  // keep helper centralized so alpha usage is consistent
  return `${hexColor}${alphaHex}`;
};
