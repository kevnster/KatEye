import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PlatformPressable } from '@react-navigation/elements';
import { useLinkBuilder } from '@react-navigation/native';
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
  index: { label: 'Overview', icon: 'view-dashboard' },
  'digital-twin': { label: 'Digital Twin', icon: 'cube-scan' },
  map: { label: 'Map', icon: 'map-outline' },
  reports: { label: 'Config', icon: 'cog' },
};

export function BottomNav({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors: appColors } = useAppTheme();
  const styles = useMemo(() => createBottomNavStyles(appColors), [appColors]);
  const { buildHref } = useLinkBuilder();

  return (
    <View style={styles.screenPad}>
      <View
        style={[
          styles.dock,
          {
            backgroundColor: appColors.tabDockBg,
            borderTopColor: appColors.tabDockBorder,
            paddingBottom: 8 + Math.max(insets.bottom, 6),
          },
        ]}>
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

          const accent = appColors.tabAccent;
          const inactive = appColors.tabInactive;

          return (
            <PlatformPressable
              key={route.key}
              href={buildHref(route.name, route.params)}
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.navItem}>
              {isFocused ? (
                <View style={styles.activeLineWrap}>
                  <View style={[styles.activeLine, { backgroundColor: accent }]} />
                </View>
              ) : null}
              <MaterialCommunityIcons
                name={config.icon}
                size={24}
                color={isFocused ? accent : inactive}
                style={{ transform: [{ scale: isFocused ? 1.08 : 1 }] }}
              />
              <Text
                style={[
                  styles.navLabel,
                  {
                    color: isFocused ? accent : inactive,
                    fontWeight: isFocused ? '800' : '600',
                  },
                ]}
                numberOfLines={2}>
                {config.label.toUpperCase()}
              </Text>
            </PlatformPressable>
          );
        })}
      </View>
    </View>
  );
}
