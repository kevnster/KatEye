import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { TopBar } from '@/components/navigation/top-bar';
import { useAlertEvents } from '@/context/alerts-events';
import { useAppTheme } from '@/context/theme';
import { createDigitalTwinStyles } from '@/features/digital-twin/digital-twin.styles';
import {
  buildTwinTelemetry,
  TwinEventLog,
  TwinGyroSections,
  TwinTelemetrySections,
  useFreshWithin,
} from '@/features/digital-twin/twin-ui';
import { formatPackageIdTitle } from '@/features/firebase/hardware-payload';
import { nearbyLocationLabel, syntheticCoordForDevice } from '@/features/map/nearby-location';

type Props = { deviceId: string };

const LIVE_WINDOW_MS = 30_000;
export function DigitalTwinScreen({ deviceId }: Props) {
  const { colors } = useAppTheme();
  const { events: allEvents, status: alertsStatus, message: alertsMessage, refresh: refreshAlerts } =
    useAlertEvents();

  const deviceEvents = useMemo(() => {
    const list = allEvents.filter((e) => e.device_id === deviceId);
    return list.sort((a, b) => a.timestamp - b.timestamp);
  }, [allEvents, deviceId]);

  const latest = deviceEvents.length > 0 ? deviceEvents[deviceEvents.length - 1]! : null;
  const isLive = useFreshWithin(latest?.timestamp ?? null, LIVE_WINDOW_MS);

  const earlierEvents = useMemo(() => {
    if (deviceEvents.length <= 1) return [];
    return [...deviceEvents].sort((a, b) => b.timestamp - a.timestamp).slice(1);
  }, [deviceEvents]);

  const latestTelemetry = useMemo(() => (latest ? buildTwinTelemetry(latest) : null), [latest]);
  const locationPreview = useMemo(() => {
    const c =
      latest?.latitude != null && latest?.longitude != null
        ? { latitude: latest.latitude, longitude: latest.longitude }
        : syntheticCoordForDevice(deviceId);
    const region: Region = {
      latitude: c.latitude,
      longitude: c.longitude,
      latitudeDelta: 0.0105,
      longitudeDelta: 0.0105,
    };
    return { ...c, region, label: nearbyLocationLabel(c) };
  }, [deviceId, latest?.latitude, latest?.longitude]);

  const styles = useMemo(() => createDigitalTwinStyles(colors), [colors]);

  const onRefresh = useCallback(() => {
    void refreshAlerts();
  }, [refreshAlerts]);

  return (
    <View style={styles.root}>
      <TopBar />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {alertsStatus === 'error' && alertsMessage ? (
          <Text style={[styles.screenMetaHint, { color: colors.danger }]}>{alertsMessage}</Text>
        ) : null}

        {deviceEvents.length === 0 && alertsStatus === 'ready' ? (
          <Text style={styles.screenMetaHint}>No alerts for this package in RTDB.</Text>
        ) : null}

        {latest && latestTelemetry ? (
          <>
            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>{formatPackageIdTitle(deviceId)}</Text>
              </View>
              <View style={[styles.liveBadge, !isLive && styles.liveBadgeOffline]}>
                <View style={[styles.liveDot, !isLive && styles.liveDotOffline]} />
                <Text style={[styles.liveText, !isLive && styles.liveTextOffline]} numberOfLines={1}>
                  {isLive ? 'Live' : 'Not live'}
                </Text>
              </View>
            </View>

            <View style={styles.sectionGap}>
              <View style={styles.sectionTitle}>
                <View style={styles.sectionTitleBar} />
                <Text style={styles.sectionTitleText}>Location</Text>
              </View>
              <Pressable
                onPress={() => router.push({ pathname: '/(tabs)/map', params: { packageId: deviceId } })}
                style={({ pressed }) => [styles.twinMapCard, pressed && { opacity: 0.94 }]}>
                <MapView
                  style={styles.twinMap}
                  region={locationPreview.region}
                  pointerEvents="none"
                  rotateEnabled={false}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  toolbarEnabled={false}
                  showsCompass={false}
                  showsPointsOfInterest={false}
                  showsBuildings={false}
                  showsIndoors={false}>
                  <Marker coordinate={{ latitude: locationPreview.latitude, longitude: locationPreview.longitude }} />
                </MapView>
              </Pressable>
              <Text style={styles.screenMetaHint}>{locationPreview.label}</Text>
            </View>

            <TwinTelemetrySections
              telemetry={latestTelemetry}
              styles={styles}
              colors={colors}
              timeSectionTitle="Last updated"
            />
            {latest.snapshot ? (
              <TwinGyroSections snapshot={latest.snapshot} styles={styles} />
            ) : (
              <Text style={styles.screenMetaHint}>No accelerometer / gyroscope snapshot on this alert.</Text>
            )}

            <TwinEventLog events={earlierEvents} styles={styles} colors={colors} />
            {earlierEvents.length === 0 && deviceEvents.length > 0 ? (
              <Text style={styles.screenMetaHint}>No earlier telemetry rows for this package.</Text>
            ) : null}
          </>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.pingButton, pressed && { opacity: 0.92 }]}
          android_ripple={{ color: '#ffffff33' }}
          onPress={onRefresh}>
          <View style={styles.pingLeft}>
            <MaterialCommunityIcons name="broadcast" size={22} color={colors.onPrimary} />
            <Text style={styles.pingLabel}>REFRESH DATA</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.onPrimary} />
        </Pressable>
      </ScrollView>
    </View>
  );
}
