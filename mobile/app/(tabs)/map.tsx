import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, type Region } from 'react-native-maps';

import { TopBar } from '@/components/navigation/top-bar';
import { useAlertEvents } from '@/context/alerts-events';
import { resolveEventTypeColor } from '@/features/dashboard/event-type-colors';
import { formatPackageIdTitle } from '@/features/firebase/hardware-payload';
import { nearbyLocationLabel, syntheticCoordForDevice } from '@/features/map/nearby-location';
import { useAppTheme } from '@/context/theme';

const FALLBACK: Region = {
  latitude: 29.6469,
  longitude: -82.3478,
  latitudeDelta: 0.022,
  longitudeDelta: 0.022,
};

const LIVE_PACKAGE = {
  id: 'KATEYE-01',
  latitude: 29.64655,
  longitude: -82.3472,
};

function relativeAge(ts: number | null) {
  if (!ts || !Number.isFinite(ts) || ts <= 0) return 'just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

function isRiskEventType(eventType: string) {
  const t = eventType.toLowerCase();
  return t.includes('impact') || t.includes('alert') || t.includes('aggressive') || t.includes('sharp');
}

function formatCoord(n: number) {
  return n.toFixed(4);
}

export default function MapScreen() {
  const { packageId: routePackageIdRaw } = useLocalSearchParams<{ packageId?: string | string[] }>();
  const { colors, scheme } = useAppTheme();
  const { events: alertEvents } = useAlertEvents();
  const hasAppliedRouteFocus = useRef(false);
  const [region, setRegion] = useState<Region>(FALLBACK);
  const [locLabel, setLocLabel] = useState<string>('Locating…');
  const [canShowUser, setCanShowUser] = useState(false);
  const [pulsePhase, setPulsePhase] = useState(0);
  const [selectedPackageRawId, setSelectedPackageRawId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'risk'>('all');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  const routePackageId = useMemo(
    () => decodeURIComponent(Array.isArray(routePackageIdRaw) ? routePackageIdRaw[0] ?? '' : routePackageIdRaw ?? ''),
    [routePackageIdRaw],
  );

  const mapPackages = useMemo(() => {
    const latestByDevice = new Map<string, (typeof alertEvents)[number]>();
    for (const evt of alertEvents) {
      const prev = latestByDevice.get(evt.device_id);
      if (!prev || evt.timestamp > prev.timestamp) latestByDevice.set(evt.device_id, evt);
    }

    const out = [...latestByDevice.entries()].map(([deviceId, evt]) => ({
      rawId: deviceId,
      id: formatPackageIdTitle(deviceId),
      latitude:
        evt.latitude != null && evt.longitude != null ? evt.latitude : syntheticCoordForDevice(deviceId).latitude,
      longitude:
        evt.latitude != null && evt.longitude != null ? evt.longitude : syntheticCoordForDevice(deviceId).longitude,
      locationLabel: nearbyLocationLabel(
        evt.latitude != null && evt.longitude != null
          ? { latitude: evt.latitude, longitude: evt.longitude }
          : syntheticCoordForDevice(deviceId),
      ),
      lastEventType: evt.event_type || 'Alert',
      lastTs: evt.timestamp || null,
    }));

    if (out.length === 0) {
      out.push({
        rawId: LIVE_PACKAGE.id,
        id: LIVE_PACKAGE.id,
        latitude: LIVE_PACKAGE.latitude,
        longitude: LIVE_PACKAGE.longitude,
        lastEventType: 'Alert',
        locationLabel: nearbyLocationLabel({ latitude: LIVE_PACKAGE.latitude, longitude: LIVE_PACKAGE.longitude }),
        lastTs: null,
      });
    }
    return out.slice(0, 12);
  }, [alertEvents]);

  const filteredPackages = useMemo(() => {
    const now = Date.now();
    return mapPackages.filter((p) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'risk') return isRiskEventType(p.lastEventType);
      if (activeFilter === 'live') return p.lastTs != null && now - p.lastTs <= 2 * 60_000;
      return true;
    });
  }, [mapPackages, activeFilter]);

  const inFramePackages = useMemo(() => {
    const halfLat = region.latitudeDelta / 2;
    const halfLng = region.longitudeDelta / 2;
    const latPad = halfLat * 0.22;
    const lngPad = halfLng * 0.22;
    const minLat = region.latitude - halfLat - latPad;
    const maxLat = region.latitude + halfLat + latPad;
    const minLng = region.longitude - halfLng - lngPad;
    const maxLng = region.longitude + halfLng + lngPad;
    return filteredPackages.filter(
      (p) => p.latitude >= minLat && p.latitude <= maxLat && p.longitude >= minLng && p.longitude <= maxLng,
    );
  }, [filteredPackages, region]);

  const selectedPackage = useMemo(
    () => mapPackages.find((p) => p.rawId === selectedPackageRawId) ?? null,
    [mapPackages, selectedPackageRawId],
  );

  useEffect(() => {
    let t = 0;
    const id = setInterval(() => {
      t += 0.11;
      const eased = (Math.sin(t) + 1) / 2;
      setPulsePhase(eased);
    }, 50);
    return () => clearInterval(id);
  }, []);

  const adjustZoom = (direction: 'in' | 'out') => {
    setRegion((prev) => {
      const factor = direction === 'in' ? 0.72 : 1.38;
      const nextLatDelta = Math.min(0.25, Math.max(0.0035, prev.latitudeDelta * factor));
      const nextLngDelta = Math.min(0.25, Math.max(0.0035, prev.longitudeDelta * factor));
      return {
        ...prev,
        latitudeDelta: nextLatDelta,
        longitudeDelta: nextLngDelta,
      };
    });
  };

  const focusOnPackage = (latitude: number, longitude: number) => {
    setRegion((prev) => ({
      latitude,
      longitude,
      latitudeDelta: Math.max(0.006, prev.latitudeDelta * 0.65),
      longitudeDelta: Math.max(0.006, prev.longitudeDelta * 0.65),
    }));
  };

  useEffect(() => {
    if (hasAppliedRouteFocus.current || !routePackageId) return;
    const target = mapPackages.find(
      (pkg) => pkg.rawId === routePackageId || pkg.id.toLowerCase() === routePackageId.toLowerCase(),
    );
    if (!target) return;
    hasAppliedRouteFocus.current = true;
    setSelectedPackageRawId(target.rawId);
    focusOnPackage(target.latitude, target.longitude);
  }, [mapPackages, routePackageId]);

  useEffect(() => {
    let cancelled = false;
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== Location.PermissionStatus.GRANTED) {
          setLocLabel('Location permission denied');
          setCanShowUser(false);
          return;
        }
        setCanShowUser(true);

        const first = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const { latitude, longitude } = first.coords;
        setLocLabel(
          `${formatCoord(latitude)}, ${formatCoord(longitude)} · ±${Math.round(first.coords.accuracy ?? 0)}m`,
        );
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 8,
          },
          (loc) => {
            if (cancelled) return;
            const { latitude: lat, longitude: lng, accuracy } = loc.coords;
            setLocLabel(`${formatCoord(lat)}, ${formatCoord(lng)} · ±${Math.round(accuracy ?? 0)}m`);
          },
        );
      } catch {
        if (!cancelled) {
          setLocLabel('Could not read location');
          setCanShowUser(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.pageBg },
        map: { flex: 1 },
        footer: {
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        footerText: {
          fontSize: 12,
          fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
          color: colors.textSecondary,
          fontWeight: '600',
        },
        liveDotWrap: {
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${colors.surface}EE`,
          borderWidth: 1,
          borderColor: `${colors.border}CC`,
        },
        liveDot: {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.danger,
          opacity: 0.7,
        },
        liveDotOn: {
          opacity: 1,
        },
        packageCard: {
          marginHorizontal: 12,
          marginBottom: 8,
          backgroundColor: colors.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 4,
        },
        packageCardTop: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        packageTitle: {
          fontSize: 13,
          fontWeight: '800',
          color: colors.textPrimary,
          letterSpacing: 0.4,
        },
        packageHint: {
          fontSize: 10,
          color: colors.textMuted,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        },
        packageMeta: {
          fontSize: 12,
          color: colors.textSecondary,
          fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
        },
        openTwinBtn: {
          marginTop: 4,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: `${colors.border}CC`,
          paddingHorizontal: 10,
          paddingVertical: 8,
          backgroundColor: `${colors.pageBg}66`,
        },
        openTwinBtnText: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.textPrimary,
          letterSpacing: 0.3,
        },
        zoomBar: {
          position: 'absolute',
          left: 10,
          top: 140,
          backgroundColor: `${colors.surface}E8`,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: `${colors.border}CC`,
          overflow: 'hidden',
        },
        zoomBtn: {
          width: 36,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
        },
        zoomDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
        },
        filterDropdownWrap: {
          position: 'absolute',
          top: 146,
          left: 54,
          alignSelf: 'flex-start',
          gap: 6,
        },
        filterChip: {
          borderRadius: 999,
          borderWidth: 1,
          borderColor: `${colors.border}CC`,
          backgroundColor: `${colors.surface}E8`,
          paddingHorizontal: 7,
          paddingVertical: 4,
          alignSelf: 'flex-start',
        },
        filterChipActive: {
          borderColor: `${colors.primary}AA`,
          backgroundColor: `${colors.primary}20`,
        },
        filterChipText: {
          fontSize: 11,
          fontWeight: '700',
          color: colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        },
        filterChipTextActive: {
          color: colors.textPrimary,
        },
        filterChipRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
        },
        filterMenu: {
          backgroundColor: `${colors.surface}F2`,
          borderWidth: 1,
          borderColor: `${colors.border}CC`,
          borderRadius: 8,
          padding: 3,
          gap: 3,
        },
        filterOption: {
          borderRadius: 999,
          borderWidth: 1,
          borderColor: `${colors.border}B0`,
          paddingHorizontal: 8,
          paddingVertical: 4,
        },
        filterOptionActive: {
          borderColor: `${colors.primary}AA`,
          backgroundColor: `${colors.primary}20`,
        },
        glanceTray: {
          position: 'absolute',
          left: 10,
          right: 10,
          bottom: 130,
        },
        glanceCard: {
          width: 190,
          backgroundColor: colors.surface,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 10,
          paddingVertical: 8,
          marginRight: 8,
          gap: 4,
        },
        glanceTitleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
        },
        glanceTitle: {
          flex: 1,
          minWidth: 0,
          fontSize: 12,
          fontWeight: '800',
          color: colors.textPrimary,
        },
        glanceMeta: {
          fontSize: 11,
          color: colors.textSecondary,
        },
        glanceEventRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        glanceEventDot: {
          width: 7,
          height: 7,
          borderRadius: 3.5,
        },
        glanceEventLabel: {
          fontSize: 11,
          color: colors.textSecondary,
        },
        glanceEventType: {
          fontWeight: '700',
        },
      }),
    [
      colors.pageBg,
      colors.surface,
      colors.border,
      colors.textSecondary,
      colors.danger,
      colors.textPrimary,
      colors.textMuted,
    ],
  );

  return (
    <View style={styles.root}>
      <TopBar />
      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        onPress={() => setFilterMenuOpen(false)}
        rotateEnabled
        pitchEnabled
        scrollEnabled
        zoomEnabled
        showsCompass={false}
        showsMyLocationButton={canShowUser}
        showsUserLocation={canShowUser}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsIndoors={false}
        toolbarEnabled={false}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        userInterfaceStyle={scheme === 'dark' ? 'dark' : 'light'}
      >
        {filteredPackages.flatMap((pkg) => [
          <Circle
            key={`pulse-${pkg.rawId}`}
            center={{ latitude: pkg.latitude, longitude: pkg.longitude }}
            radius={20 + pulsePhase * 24}
            strokeWidth={0}
            fillColor={`rgba(255,77,106,${0.16 + pulsePhase * 0.24})`}
          />,
          <Marker
            key={`marker-${pkg.rawId}`}
            coordinate={{ latitude: pkg.latitude, longitude: pkg.longitude }}
            tracksViewChanges={false}
            onPress={() => setSelectedPackageRawId(pkg.rawId)}>
            <View style={styles.liveDotWrap}>
              <View style={[styles.liveDot, { opacity: 0.55 + pulsePhase * 0.45 }]} />
            </View>
          </Marker>,
        ])}
      </MapView>
      <View style={styles.filterDropdownWrap}>
        <Pressable
          onPress={() => setFilterMenuOpen((v) => !v)}
          style={[styles.filterChip, styles.filterChipActive]}>
          <View style={styles.filterChipRow}>
            <Text style={[styles.filterChipText, styles.filterChipTextActive]}>{activeFilter}</Text>
            <MaterialCommunityIcons
              name={filterMenuOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.textPrimary}
            />
          </View>
        </Pressable>
        {filterMenuOpen ? (
          <View style={styles.filterMenu}>
            {(['all', 'live', 'risk'] as const).map((f) => (
              <Pressable
                key={f}
                onPress={() => {
                  setActiveFilter(f);
                  setFilterMenuOpen(false);
                }}
                style={[styles.filterOption, activeFilter === f && styles.filterOptionActive]}>
                <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>
                  {f}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.zoomBar}>
        <Pressable onPress={() => adjustZoom('in')} style={styles.zoomBtn}>
          <MaterialCommunityIcons name="plus" size={18} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.zoomDivider} />
        <Pressable onPress={() => adjustZoom('out')} style={styles.zoomBtn}>
          <MaterialCommunityIcons name="minus" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>
      <View style={styles.glanceTray}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 4 }}>
          {inFramePackages.length === 0 ? (
            <View style={styles.glanceCard}>
              <Text style={styles.glanceTitle}>No packages in frame</Text>
              <Text style={styles.glanceMeta}>Pan/zoom to find nearby packages.</Text>
            </View>
          ) : (
            inFramePackages.map((pkg) => (
              <Pressable
                key={pkg.rawId}
                style={styles.glanceCard}
                onPress={() => {
                  setSelectedPackageRawId(pkg.rawId);
                  focusOnPackage(pkg.latitude, pkg.longitude);
                }}>
                <View style={styles.glanceTitleRow}>
                  <Text style={styles.glanceTitle} numberOfLines={1}>
                    {pkg.id}
                  </Text>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push(`/(tabs)/digital-twin/${encodeURIComponent(pkg.rawId)}`);
                    }}>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textPrimary} />
                  </Pressable>
                </View>
                <Text style={styles.glanceMeta}>{pkg.locationLabel}</Text>
                <View style={styles.glanceEventRow}>
                  <View
                    style={[
                      styles.glanceEventDot,
                      { backgroundColor: resolveEventTypeColor(pkg.lastEventType, colors) },
                    ]}
                  />
                  <Text style={styles.glanceEventLabel}>
                    Event:{' '}
                    <Text
                      style={[
                        styles.glanceEventType,
                        { color: resolveEventTypeColor(pkg.lastEventType, colors) },
                      ]}>
                      {pkg.lastEventType}
                    </Text>
                  </Text>
                </View>
                <Text style={styles.glanceMeta}>Last ping: {relativeAge(pkg.lastTs)}</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText} numberOfLines={2}>
          {inFramePackages.length} package(s) in frame · use card chevron for twin · {locLabel}
        </Text>
      </View>
    </View>
  );
}
