import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createTopBarStyles } from '@/components/navigation/top-bar.styles';
import { useAppTheme } from '@/context/theme';

export function TopBar() {
  const insets = useSafeAreaInsets();
  const { colors, scheme, toggleLightDark } = useAppTheme();
  const styles = useMemo(() => createTopBarStyles(colors), [colors]);

  return (
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <View style={styles.logoContainer}>
        <MaterialCommunityIcons name="cat" size={26} color={colors.primary} />
        <Text style={styles.logoText}>KATEYE</Text>
      </View>
      <View style={styles.topBarActions}>
        <Pressable style={styles.iconButton} onPress={toggleLightDark} accessibilityLabel="toggle color scheme">
          <MaterialCommunityIcons
            name={scheme === 'dark' ? 'white-balance-sunny' : 'weather-night'}
            size={20}
            color={colors.iconMuted}
          />
        </Pressable>
        <Pressable style={styles.iconButton}>
          <MaterialCommunityIcons name="bell-outline" size={20} color={colors.iconMuted} />
          <View style={styles.notificationDot} />
        </Pressable>
      </View>
    </View>
  );
}
