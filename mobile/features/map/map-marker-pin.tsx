import { View } from 'react-native';

type Props = {
  accent: string;
  rim: string;
};

export function MapMarkerPin({ accent, rim }: Props) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: accent,
        borderWidth: 3,
        borderColor: rim,
        shadowColor: accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 10,
        elevation: 8,
      }}
    />
  );
}
