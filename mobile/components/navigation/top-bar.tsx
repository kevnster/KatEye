import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { styles } from '@/components/navigation/top-bar.styles';

export function TopBar() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <View style={styles.logoContainer}>
        <MaterialCommunityIcons name="shield-check" size={24} color="#2563EB" />
        <Text style={styles.logoText}>KATEYE</Text>
      </View>
      <View style={styles.topBarActions}>
        <Pressable style={styles.iconButton}>
          <MaterialCommunityIcons name="bell-outline" size={20} color="#6B7280" />
          <View style={styles.notificationDot} />
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>OP</Text>
        </View>
      </View>
    </View>
  );
}
