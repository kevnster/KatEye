import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';

import { TopBar } from '@/components/navigation/top-bar';
import { useAppTheme } from '@/context/theme';

const FALLBACK: Region = {
  latitude: 29.6516,
  longitude: -82.3248,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const ZOOMED: Pick<Region, 'latitudeDelta' | 'longitudeDelta'> = {
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

function formatCoord(n: number) {
  return n.toFixed(4);
}

export default function MapScreen() {
  const { colors, scheme } = useAppTheme();
  const mapRef = useRef<MapView>(null);
  const didCenterOnUser = useRef(false);
  const [region, setRegion] = useState<Region>(FALLBACK);
  const [locLabel, setLocLabel] = useState<string>('Locating…');
  const [canShowUser, setCanShowUser] = useState(false);

  const centerOnCoords = useCallback((latitude: number, longitude: number) => {
    const next: Region = { latitude, longitude, ...ZOOMED };
    setRegion(next);
    mapRef.current?.animateToRegion(next, 450);
  }, []);

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
        if (!didCenterOnUser.current) {
          didCenterOnUser.current = true;
          centerOnCoords(latitude, longitude);
        }

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
  }, [centerOnCoords]);

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
      }),
    [colors.pageBg, colors.surface, colors.border, colors.textSecondary],
  );

  return (
    <View style={styles.root}>
      <TopBar />
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
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
      />
      <View style={styles.footer}>
        <Text style={styles.footerText} numberOfLines={2}>
          {locLabel}
        </Text>
      </View>
    </View>
  );
}
