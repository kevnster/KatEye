import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { TopBar } from '@/components/navigation/top-bar';
import { useAlertEvents } from '@/context/alerts-events';
import { useAppTheme } from '@/context/theme';
import { TelemetrySourceCard } from '@/features/dashboard/overview-ui';
import { createDashboardStyles } from '@/features/dashboard/styles/index.styles';
import { themeBase as t } from '@/styles/app-theme';

export default function ConfigScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createDashboardStyles(colors), [colors]);
  const { status, message, refresh } = useAlertEvents();

  const hintStyles = useMemo(
    () => ({
      sectionLabel: {
        marginTop: 8,
        marginBottom: 6,
        fontSize: 11,
        fontWeight: '800' as const,
        letterSpacing: 2,
        color: colors.textMuted,
        textTransform: 'uppercase' as const,
      },
      comingSoon: {
        marginTop: 28,
        fontSize: t.fontSize.titleLg,
        fontWeight: '600' as const,
        color: colors.textSecondary,
        textAlign: 'center' as const,
      },
    }),
    [colors.textMuted, colors.textSecondary],
  );

  return (
    <View style={styles.page}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={hintStyles.sectionLabel}>Data connection</Text>
        <TelemetrySourceCard status={status} message={message} onRefresh={() => void refresh()} styles={styles} />

        <Text style={hintStyles.comingSoon}>More settings coming soon…</Text>
      </ScrollView>
    </View>
  );
}
