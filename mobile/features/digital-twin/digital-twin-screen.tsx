import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { TopBar } from '@/components/navigation/top-bar';
import { useAlertEvents } from '@/context/alerts-events';
import { useDisplayPreferences } from '@/context/display-preferences';
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

type TimeFilterKey = 'all' | '1h' | '6h' | '24h' | '7d';

const TIME_FILTERS: { key: TimeFilterKey; label: string; ms: number }[] = [
  { key: 'all', label: 'All', ms: 0 },
  { key: '1h', label: '1h', ms: 3_600_000 },
  { key: '6h', label: '6h', ms: 21_600_000 },
  { key: '24h', label: '24h', ms: 86_400_000 },
  { key: '7d', label: '7d', ms: 604_800_000 },
];

export function DigitalTwinScreen({ deviceId }: Props) {
  const { colors } = useAppTheme();
  const { clockFormat } = useDisplayPreferences();
  const { events: allEvents, status: alertsStatus, message: alertsMessage, refresh: refreshAlerts } =
    useAlertEvents();
  const [timeFilter, setTimeFilter] = useState<TimeFilterKey>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [timeMenuOpen, setTimeMenuOpen] = useState(false);
  const [eventMenuOpen, setEventMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

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
  const previousSnapshot = useMemo(
    () => earlierEvents.find((event) => !!event.snapshot?.accel_x?.length)?.snapshot ?? null,
    [earlierEvents],
  );

  const eventTypeOptions = useMemo(
    () => ['all', ...new Set(earlierEvents.map((e) => e.event_type).filter(Boolean))],
    [earlierEvents],
  );
  const timeFilterLabel = useMemo(
    () => TIME_FILTERS.find((f) => f.key === timeFilter)?.label ?? 'All',
    [timeFilter],
  );

  const filteredEarlierEvents = useMemo(() => {
    const now = Date.now();
    const selectedWindow = TIME_FILTERS.find((f) => f.key === timeFilter) ?? TIME_FILTERS[0]!;
    const minTs = selectedWindow.ms > 0 ? now - selectedWindow.ms : 0;
    const withTime = selectedWindow.ms > 0 ? earlierEvents.filter((e) => e.timestamp >= minTs) : earlierEvents;
    const withType = eventFilter === 'all' ? withTime : withTime.filter((e) => e.event_type === eventFilter);
    return [...withType].sort((a, b) => (sortOrder === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp));
  }, [earlierEvents, timeFilter, eventFilter, sortOrder]);

  const latestTelemetry = useMemo(
    () => (latest ? buildTwinTelemetry(latest, clockFormat === '12h') : null),
    [latest, clockFormat],
  );
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
              previousSnapshot={previousSnapshot}
              styles={styles}
              colors={colors}
              timeSectionTitle="Last updated"
            />
            {latest.snapshot ? (
              <TwinGyroSections
                snapshot={latest.snapshot}
                previousSnapshot={previousSnapshot}
                styles={styles}
                colors={colors}
              />
            ) : (
              <Text style={styles.screenMetaHint}>No accelerometer / gyroscope snapshot on this alert.</Text>
            )}

            <TwinEventLog
              events={filteredEarlierEvents}
              styles={styles}
              colors={colors}
              filtersUi={
                earlierEvents.length > 0 ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.dropdownWrap, timeMenuOpen && styles.dropdownWrapOpen]}>
                        <Pressable
                          onPress={() => {
                            setTimeMenuOpen((v) => !v);
                            setEventMenuOpen(false);
                            setSortMenuOpen(false);
                          }}
                          style={[
                            {
                              width: 30,
                              height: 30,
                              borderRadius: 7,
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.surface,
                              alignItems: 'center',
                              justifyContent: 'center',
                            },
                            timeMenuOpen && { borderColor: `${colors.primary}aa`, backgroundColor: `${colors.primary}22` },
                          ]}
                          accessibilityLabel={`Time filter ${timeFilterLabel}`}>
                          <MaterialCommunityIcons name="timeline-clock-outline" size={16} color={colors.textMuted} />
                        </Pressable>
                        {timeMenuOpen ? (
                          <View style={styles.dropdownMenu}>
                            {TIME_FILTERS.map((option) => (
                              <Pressable
                                key={option.key}
                                onPress={() => {
                                  setTimeFilter(option.key);
                                  setTimeMenuOpen(false);
                                }}
                                style={styles.dropdownItem}>
                                <Text
                                  style={[
                                    styles.dropdownItemText,
                                    timeFilter === option.key && styles.dropdownItemTextActive,
                                  ]}>
                                  {option.label}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                      </View>

                      <View style={[styles.dropdownWrap, eventMenuOpen && styles.dropdownWrapOpen]}>
                        <Pressable
                          onPress={() => {
                            setEventMenuOpen((v) => !v);
                            setTimeMenuOpen(false);
                            setSortMenuOpen(false);
                          }}
                          style={[
                            {
                              width: 30,
                              height: 30,
                              borderRadius: 7,
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.surface,
                              alignItems: 'center',
                              justifyContent: 'center',
                            },
                            eventMenuOpen && { borderColor: `${colors.primary}aa`, backgroundColor: `${colors.primary}22` },
                          ]}
                          accessibilityLabel={`Event filter ${eventFilter === 'all' ? 'all events' : eventFilter}`}>
                          <MaterialCommunityIcons name="lightning-bolt-outline" size={16} color={colors.textMuted} />
                        </Pressable>
                        {eventMenuOpen ? (
                          <View style={[styles.dropdownMenu, { minWidth: 260, left: -54 }]}>
                            <ScrollView nestedScrollEnabled style={styles.dropdownScroll}>
                              {eventTypeOptions.map((option) => (
                                <Pressable
                                  key={option}
                                  onPress={() => {
                                    setEventFilter(option);
                                    setEventMenuOpen(false);
                                  }}
                                  style={styles.dropdownItem}>
                                  <Text
                                    style={[
                                      styles.dropdownItemText,
                                      eventFilter === option && styles.dropdownItemTextActive,
                                    ]}>
                                    {option === 'all' ? 'All events' : option}
                                  </Text>
                                </Pressable>
                              ))}
                            </ScrollView>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.dropdownWrap}>
                        <Pressable
                          onPress={() => {
                            setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'));
                            setTimeMenuOpen(false);
                            setEventMenuOpen(false);
                            setSortMenuOpen(false);
                          }}
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 7,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.surface,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          accessibilityLabel={`Sort ${sortOrder === 'newest' ? 'newest first' : 'oldest first'}`}>
                          <MaterialCommunityIcons
                            name={sortOrder === 'newest' ? 'sort-clock-descending-outline' : 'sort-clock-ascending-outline'}
                            size={16}
                            color={colors.textMuted}
                          />
                        </Pressable>
                      </View>

                      <Pressable
                        onPress={() => {
                          setTimeFilter('all');
                          setEventFilter('all');
                          setSortOrder('newest');
                          setTimeMenuOpen(false);
                          setEventMenuOpen(false);
                          setSortMenuOpen(false);
                        }}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 7,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                        <MaterialCommunityIcons name="filter-remove-outline" size={14} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  </>
                ) : null
              }
              use12h={clockFormat === '12h'}
            />
            {earlierEvents.length === 0 && deviceEvents.length > 0 ? (
              <Text style={styles.screenMetaHint}>No earlier telemetry rows for this package.</Text>
            ) : filteredEarlierEvents.length === 0 ? (
              <Text style={styles.screenMetaHint}>No telemetry rows match the current filters.</Text>
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
