import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { TopBar } from '@/components/navigation/top-bar';
import { useAppTheme } from '@/context/theme';
import { kateyeMapStyle } from '@/features/map/kateye-map-style';
import { MapMarkerPin } from '@/features/map/map-marker-pin';

/** placeholder focus — mediterranean / n africa, tweak anytime */
const PLACEHOLDER_CENTER = { latitude: 28, longitude: 12 };

export default function MapScreen() {
  const { colors, scheme } = useAppTheme();

  const initialRegion = useMemo(
    () => ({
      ...PLACEHOLDER_CENTER,
      latitudeDelta: 65,
      longitudeDelta: 65,
    }),
    [],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <TopBar />
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
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
        customMapStyle={Platform.OS === 'android' ? kateyeMapStyle : undefined}>
        <Marker coordinate={PLACEHOLDER_CENTER} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <MapMarkerPin accent={colors.tabAccent} rim={scheme === 'dark' ? colors.pageBg : colors.surface} />
        </Marker>
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
