import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { TopBar } from '@/components/navigation/top-bar';
import { useAppTheme } from '@/context/theme';
import { createDigitalTwinStyles } from '@/features/digital-twin/digital-twin.styles';
import type { ThemeColors } from '@/styles/app-theme';

const TWIN_IMAGE = 'https://picsum.photos/seed/tech-head/400/400';

const SCAN_TRAVEL = 188;

type LedgerStatus = 'nominal' | 'critical' | 'info';

type LedgerEntry = {
  status: LedgerStatus;
  title: string;
  time: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  extra?: string;
  rowAlt?: boolean;
};

const LEDGER: LedgerEntry[] = [
  {
    status: 'nominal',
    title: 'Nominal Movement',
    time: '14:22:01 UTC',
    icon: 'information-outline',
  },
  {
    status: 'critical',
    title: 'Critical Impact Detected',
    time: '14:18:45 UTC',
    icon: 'alert-outline',
    extra: '4.2 Gs',
    rowAlt: true,
  },
  {
    status: 'info',
    title: 'GPS Relink Successful',
    time: '14:15:30 UTC',
    icon: 'map-marker-outline',
  },
  {
    status: 'info',
    title: 'Low Temp Threshold Warning',
    time: '13:58:12 UTC',
    icon: 'thermometer',
    rowAlt: true,
  },
];

function statusDotColor(status: LedgerStatus, c: ThemeColors) {
  if (status === 'nominal') return c.tabAccent;
  if (status === 'critical') return c.warning;
  return `${c.primary}66`;
}

export function DigitalTwinScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createDigitalTwinStyles(colors), [colors]);
  const scan = useSharedValue(0);

  useEffect(() => {
    scan.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.linear }),
      -1,
      true,
    );
  }, [scan]);

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scan.value * SCAN_TRAVEL }],
  }));

  return (
    <View style={styles.root}>
      <TopBar />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>Telemetry Active</Text>
            <Text style={styles.heroTitle}>SN-992-BETA</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        </View>

        <View style={styles.twinSection}>
          <View style={styles.twinDepth} />
          <View style={styles.twinCrossV} />
          <View style={styles.twinCrossH} />
          <View style={styles.twinSectionInner}>
            <View style={styles.twinFrame}>
              <Image
                source={{ uri: TWIN_IMAGE }}
                style={styles.twinImage}
                contentFit="cover"
                transition={200}
              />
              <View style={styles.scanClip}>
                <Animated.View style={[styles.scanLine, scanStyle]} />
              </View>
            </View>
          </View>
          <View style={styles.orientTag}>
            <Text style={styles.orientLabel}>Orientation</Text>
            <Text style={styles.orientValue}>322.4°</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.pingButton, pressed && { opacity: 0.92 }]}
          android_ripple={{ color: '#ffffff33' }}>
          <View style={styles.pingLeft}>
            <MaterialCommunityIcons name="broadcast" size={22} color="#FFFFFF" />
            <Text style={styles.pingLabel}>PING NODE STATUS</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#FFFFFF" />
        </Pressable>

        <View style={styles.sectionGap}>
          <View style={styles.sectionTitle}>
            <View style={styles.sectionTitleBar} />
            <Text style={styles.sectionTitleText}>Live Accelerometer</Text>
          </View>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>axis_x</Text>
              <Text style={styles.metricValue}>0.05</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>axis_y</Text>
              <Text style={styles.metricValue}>-0.02</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={[styles.metricLabel, styles.metricLabelSecondary]}>axis_z</Text>
              <Text style={styles.metricValue}>1.02</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionGap}>
          <View style={styles.ledgerHeader}>
            <View style={styles.sectionTitle}>
              <View style={[styles.sectionTitleBar, styles.sectionTitleBarWarn]} />
              <Text style={styles.sectionTitleText}>Telemetry Ledger</Text>
            </View>
            <Text style={styles.ledgerUptime}>UPTIME: 12h 44m</Text>
          </View>
          <View style={styles.ledgerBox}>
            {LEDGER.map((row, i) => (
              <View
                key={row.title}
                style={[
                  styles.ledgerRow,
                  row.rowAlt ? styles.ledgerRowBgAlt : styles.ledgerRowBg,
                  i < LEDGER.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: `${colors.border}55`,
                  },
                ]}>
                <View style={styles.ledgerLeft}>
                  <View
                    style={[
                      styles.ledgerDot,
                      { backgroundColor: statusDotColor(row.status, colors) },
                    ]}
                  />
                  <View>
                    <Text
                      style={[
                        styles.ledgerTitle,
                        row.status === 'critical' && styles.ledgerTitleCritical,
                      ]}>
                      {row.title}
                    </Text>
                    <Text style={styles.ledgerTime}>{row.time}</Text>
                  </View>
                </View>
                <View style={styles.ledgerRight}>
                  {row.extra ? <Text style={styles.ledgerExtra}>{row.extra}</Text> : null}
                  <MaterialCommunityIcons name={row.icon} size={18} color={colors.iconMuted} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
