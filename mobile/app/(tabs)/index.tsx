import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { TopBar } from '@/components/navigation/top-bar';
import { useAlertEvents } from '@/context/alerts-events';
import { useAppTheme } from '@/context/theme';
import { EventTypeDonut } from '@/features/dashboard/event-type-donut';
import {
  CriticalWindowsSection,
  DashboardStatsGrid,
  FleetActivityStrip,
  TrackedPackageCard,
} from '@/features/dashboard/overview-ui';
import { buildFleetDashboard, createDashboardPalette } from '@/features/dashboard/package-dashboard-model';
import { createDashboardStyles } from '@/features/dashboard/styles/index.styles';

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createDashboardStyles(colors), [colors]);
  const palette = useMemo(() => createDashboardPalette(colors), [colors]);
  const {
    status: alertsStatus,
    message: alertsMessage,
    events: alertEvents,
    refresh,
  } = useAlertEvents();
  const dashboard = useMemo(() => buildFleetDashboard(alertEvents), [alertEvents]);
  const [selectedBucket, setSelectedBucket] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const filteredPackages = useMemo(() => {
    if (!dashboard || selectedBucket == null) return dashboard?.packages ?? [];
    const bucket = dashboard.activity.hourBuckets[selectedBucket];
    if (!bucket?.deviceIds.length) return [];
    const allow = new Set(bucket.deviceIds);
    return dashboard.packages.filter((p) => allow.has(p.id));
  }, [dashboard, selectedBucket]);

  return (
    <View style={styles.page}>
      <TopBar />
      <ScrollView
        style={styles.overviewColumn}
        contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onPullRefresh()} />}>
        <View style={styles.heroRow}>
          <Text style={styles.heading}>Fleet Overview</Text>
        </View>

        {dashboard ? (
          <>
            <DashboardStatsGrid stats={dashboard.stats} styles={styles} colors={colors} palette={palette} />
            <FleetActivityStrip
              activity={dashboard.activity}
              colors={colors}
              styles={styles}
              selectedBucket={selectedBucket}
              onSelectBucket={setSelectedBucket}
            />
            <EventTypeDonut slices={dashboard.eventMix} colors={colors} styles={styles} />
            <View style={styles.devicesRow}>
              <Text style={styles.sectionTitle}>Devices</Text>
              {selectedBucket != null ? (
                <Pressable style={styles.filterChip} onPress={() => setSelectedBucket(null)}>
                  <Text style={styles.filterChipText}>CLEAR FILTER</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.deviceScrollContent}>
              {filteredPackages.length === 0 ? (
                <Text style={styles.testMessage}>No devices in this hour.</Text>
              ) : (
                filteredPackages.map((pkg) => (
                  <TrackedPackageCard
                    key={pkg.id}
                    pkg={pkg}
                    styles={styles}
                    colors={colors}
                    palette={palette}
                    onOpenDigitalTwin={() =>
                      router.push(`/(tabs)/digital-twin/${encodeURIComponent(pkg.id)}`)
                    }
                  />
                ))
              )}
            </View>
            <CriticalWindowsSection alerts={dashboard.alerts} styles={styles} palette={palette} compact />
          </>
        ) : (
          <Text style={styles.testMessage}>
            {alertsStatus === 'loading'
              ? 'Loading…'
              : alertsStatus === 'error'
                ? (alertsMessage ?? 'Could not load alerts.')
                : 'No alerts yet. Push data to RTDB path "alerts" or use fixture mode (EXPO_PUBLIC_RTD_USE_FIXTURE=1 / empty DATABASE_URL).'}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
