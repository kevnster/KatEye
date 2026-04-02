import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PlatformPressable } from '@react-navigation/elements';
import { useLinkBuilder, useTheme } from '@react-navigation/native';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createBottomNavStyles } from '@/components/navigation/bottom-nav.styles';
import { useAppTheme } from '@/context/theme';

const TAB_CONFIG: Record<
  string,
  { label: string; icon: ComponentProps<typeof MaterialCommunityIcons>['name'] }
> = {
  index: { label: 'Dashboard', icon: 'view-dashboard' },
  tracking: { label: 'Tracking', icon: 'crosshairs-gps' },
  keys: { label: 'Keys', icon: 'key-variant' },
  reports: { label: 'Reports', icon: 'file-document-outline' },
};

export function BottomNav({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { colors: appColors } = useAppTheme();
  const styles = useMemo(() => createBottomNavStyles(appColors), [appColors]);
  const { buildHref } = useLinkBuilder();

  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: colors.card }]}>
      {state.routes.map((route, index) => {
        const config = TAB_CONFIG[route.name];
        if (!config) return null;

        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <PlatformPressable
            key={route.key}
            href={buildHref(route.name, route.params)}
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarButtonTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={[styles.navItem, isFocused && { backgroundColor: appColors.navActive }]}>
            <MaterialCommunityIcons
              name={config.icon}
              size={20}
              color={isFocused ? colors.primary : colors.text}
            />
            <Text style={[styles.navLabel, { color: isFocused ? colors.primary : colors.text }]}>{config.label}</Text>
          </PlatformPressable>
        );
      })}
    </View>
  );
}
