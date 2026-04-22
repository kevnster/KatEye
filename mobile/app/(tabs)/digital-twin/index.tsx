import { Link } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ScreenFade } from '@/components/animation/screen-fade';
import { TopBar } from '@/components/navigation/top-bar';
import { useAlertEvents } from '@/context/alerts-events';
import { useAppTheme } from '@/context/theme';
import { createDigitalTwinStyles } from '@/features/digital-twin/digital-twin.styles';
import { formatPackageIdTitle } from '@/features/firebase/hardware-payload';

export default function DigitalTwinIndexScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createDigitalTwinStyles(colors), [colors]);
  const { events, status, message } = useAlertEvents();
  const deviceIds = useMemo(
    () => [...new Set(events.map((e) => e.device_id).filter(Boolean))].sort(),
    [events],
  );

  return (
    <ScreenFade>
      <View style={styles.root}>
        <TopBar />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.sectionGap}>
            <View style={styles.sectionTitle}>
              <View style={styles.sectionTitleBar} />
              <Text style={styles.sectionTitleText}>Digital twin</Text>
            </View>
          </View>
          {status === 'loading' ? <Text style={styles.screenMetaHint}>Loading…</Text> : null}
          {message && status === 'error' ? (
            <Text style={[styles.screenMetaHint, { color: colors.danger }]}>{message}</Text>
          ) : null}
          {deviceIds.length === 0 && status === 'ready' ? (
            <Text style={styles.screenMetaHint}>No devices in alerts.</Text>
          ) : null}
          {deviceIds.map((id) => (
            <Link
              key={id}
              href={`/(tabs)/digital-twin/${encodeURIComponent(id)}`}
              style={{
                marginTop: 12,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 4,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13 }}>
                {formatPackageIdTitle(id)}
              </Text>
            </Link>
          ))}
        </ScrollView>
      </View>
    </ScreenFade>
  );
}
