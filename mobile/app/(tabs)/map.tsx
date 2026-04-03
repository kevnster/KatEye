import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView from 'react-native-maps';

import { TopBar } from '@/components/navigation/top-bar';
import { useAppTheme } from '@/context/theme';

const INITIAL = {
  latitude: 29.6516,
  longitude: -82.3248,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

export default function MapScreen() {
  const { colors, scheme } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.pageBg },
        map: { flex: 1 },
      }),
    [colors.pageBg],
  );

  return (
    <View style={styles.root}>
      <TopBar />
      <MapView
        style={styles.map}
        initialRegion={INITIAL}
        rotateEnabled
        pitchEnabled
        scrollEnabled
        zoomEnabled
        showsCompass={false}
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsIndoors={false}
        toolbarEnabled={false}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        userInterfaceStyle={scheme === 'dark' ? 'dark' : 'light'}
      />
    </View>
  );
}
