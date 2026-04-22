import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ScreenFade } from '@/components/animation/screen-fade';
import { TopBar } from '@/components/navigation/top-bar';
import { useAlertEvents } from '@/context/alerts-events';
import { useDisplayPreferences } from '@/context/display-preferences';
import { useAppTheme } from '@/context/theme';
import { TelemetrySourceCard } from '@/features/dashboard/overview-ui';
import { createDashboardStyles } from '@/features/dashboard/styles/index.styles';
import { themeBase as t } from '@/styles/app-theme';

export default function ConfigScreen() {
  const { colors } = useAppTheme();
  const { clockFormat, setClockFormat } = useDisplayPreferences();
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
        marginTop: 20,
        fontSize: t.fontSize.titleLg,
        fontWeight: '600' as const,
        color: colors.textSecondary,
        textAlign: 'center' as const,
      },
      preferenceCard: {
        marginTop: 4,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: 12,
        gap: 10,
      },
      preferenceTitle: {
        fontSize: t.fontSize.body,
        fontWeight: '700' as const,
        color: colors.textPrimary,
      },
      preferenceHint: {
        fontSize: t.fontSize.md,
        color: colors.textMuted,
      },
      chipRow: {
        flexDirection: 'row' as const,
        gap: 8,
      },
      chip: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      },
      chipActive: {
        borderColor: colors.primary,
        backgroundColor: `${colors.primary}22`,
      },
      chipText: {
        fontSize: t.fontSize.md,
        fontWeight: '700' as const,
        color: colors.textSecondary,
      },
      chipTextActive: {
        color: colors.primary,
      },
      badgeRow: {
        flexDirection: 'row' as const,
        flexWrap: 'wrap' as const,
        gap: 8,
      },
      badge: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingVertical: 6,
        paddingHorizontal: 10,
      },
      badgeText: {
        fontSize: t.fontSize.md,
        fontWeight: '700' as const,
        color: colors.textSecondary,
      },
    }),
    [
      colors.border,
      colors.primary,
      colors.surface,
      colors.textMuted,
      colors.textPrimary,
      colors.textSecondary,
    ],
  );

  return (
    <ScreenFade>
      <View style={styles.page}>
        <TopBar />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={hintStyles.sectionLabel}>Display</Text>
          <View style={hintStyles.preferenceCard}>
            <Text style={hintStyles.preferenceTitle}>Time format</Text>
            <Text style={hintStyles.preferenceHint}>Choose how timestamps appear across the app.</Text>
            <View style={hintStyles.chipRow}>
              {(['12h', '24h'] as const).map((format) => {
                const active = clockFormat === format;
                return (
                  <Pressable
                    key={format}
                    onPress={() => setClockFormat(format)}
                    style={[hintStyles.chip, active && hintStyles.chipActive]}>
                    <Text style={[hintStyles.chipText, active && hintStyles.chipTextActive]}>
                      {format === '12h' ? '12-hour (AM/PM)' : '24-hour'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text style={hintStyles.sectionLabel}>Build info</Text>
          <View style={hintStyles.preferenceCard}>
            <View style={hintStyles.badgeRow}>
              <View style={hintStyles.badge}>
                <Text style={hintStyles.badgeText}>Developer Build</Text>
              </View>
              <View style={hintStyles.badge}>
                <Text style={hintStyles.badgeText}>v1.0 beta</Text>
              </View>
            </View>
          </View>

          <Text style={hintStyles.sectionLabel}>Data connection</Text>
          <TelemetrySourceCard status={status} message={message} onRefresh={() => void refresh()} styles={styles} />

          <Text style={hintStyles.comingSoon}>More settings coming soon…</Text>
        </ScrollView>
      </View>
    </ScreenFade>
  );
}
