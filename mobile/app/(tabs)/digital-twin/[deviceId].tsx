import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { DigitalTwinScreen } from '@/features/digital-twin/digital-twin-screen';

export default function DigitalTwinDeviceScreen() {
  const { deviceId: raw } = useLocalSearchParams<{ deviceId: string | string[] }>();
  const deviceId = Array.isArray(raw) ? raw[0] : raw;

  if (!deviceId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text>Missing device id.</Text>
      </View>
    );
  }

  return <DigitalTwinScreen deviceId={decodeURIComponent(deviceId)} />;
}
