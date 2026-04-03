import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import type { ViewStyle } from 'react-native';
import { Pressable, Text, View } from 'react-native';
import Animated, { type AnimatedStyle, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { createDigitalTwinStyles } from '@/features/digital-twin/digital-twin.styles';
import type { HardwareLogEvent } from '@/features/firebase/hardware-payload';
import {
  formatTimestampEstMmDdYyAnd24h,
  type AlertEventRow,
  type ImuSnapshot,
} from '@/features/firebase/event-rows';
import type { ThemeColors } from '@/styles/app-theme';

type TwinStyles = ReturnType<typeof createDigitalTwinStyles>;

const TWIN_IMAGE = 'https://picsum.photos/seed/tech-head/400/400';
const SCAN_TRAVEL = 188;

export function useTwinScanLine() {
  const scan = useSharedValue(0);

  useEffect(() => {
    scan.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, true);
  }, [scan]);

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scan.value * SCAN_TRAVEL }],
  }));

  return { scanStyle };
}

export function useFreshWithin(timestamp: number | null, windowMs: number, tickMs = 1000): boolean {
  const [fresh, setFresh] = useState(() => timestamp != null && Date.now() - timestamp <= windowMs);
  useEffect(() => {
    const tick = () => setFresh(timestamp != null && Date.now() - timestamp <= windowMs);
    tick();
    const id = setInterval(tick, tickMs);
    return () => clearInterval(id);
  }, [timestamp, windowMs, tickMs]);
  return fresh;
}

export type DigitalTwinTelemetry = {
  displayPackageId: string;
  batchLabel: string | null;
  locationLabel: string;
  sample: HardwareLogEvent | null;
  sampleTimeLabel: string | null;
};

export function buildTwinTelemetry(row: AlertEventRow): DigitalTwinTelemetry {
  const { snapshot } = row;
  if (!snapshot || snapshot.accel_x.length === 0) {
    return {
      displayPackageId: row.device_id,
      batchLabel: row.event_type,
      locationLabel: row.event_type,
      sample: null,
      sampleTimeLabel: row.timestamp ? `${formatTimestampEstMmDdYyAnd24h(row.timestamp)} EST` : null,
    };
  }
  const n = snapshot.accel_x.length;
  const i = Math.max(0, n - 1);
  const sample: HardwareLogEvent | null =
    n > 0
      ? {
          ts: row.timestamp,
          accel: {
            x: snapshot.accel_x[i] ?? 0,
            y: snapshot.accel_y[i] ?? 0,
            z: snapshot.accel_z[i] ?? 0,
          },
        }
      : null;
  return {
    displayPackageId: row.device_id,
    batchLabel: row.event_type,
    locationLabel: row.event_type,
    sample,
    sampleTimeLabel: `${formatTimestampEstMmDdYyAnd24h(row.timestamp)} EST`,
  };
}

export function TwinViewport({
  styles,
  scanStyle,
}: {
  styles: TwinStyles;
  scanStyle: AnimatedStyle<ViewStyle>;
}) {
  return (
    <View style={styles.twinSection}>
      <View style={styles.twinDepth} />
      <View style={styles.twinCrossV} />
      <View style={styles.twinCrossH} />
      <View style={styles.twinSectionInner}>
        <View style={styles.twinFrame}>
          <Image source={{ uri: TWIN_IMAGE }} style={styles.twinImage} contentFit="cover" transition={200} />
          <View style={styles.scanClip}>
            <Animated.View style={[styles.scanLine, scanStyle]} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function TwinTelemetrySections({
  telemetry,
  styles,
  colors,
  timeSectionTitle = 'Sample time',
}: {
  telemetry: DigitalTwinTelemetry;
  styles: TwinStyles;
  colors: ThemeColors;
  timeSectionTitle?: string;
}) {
  const { sample, sampleTimeLabel } = telemetry;
  return (
    <>
      <View style={styles.lastUpdatedRow}>
        <Text style={styles.lastUpdatedLabel}>{timeSectionTitle}</Text>
        <Text
          style={[styles.lastUpdatedValue, { color: colors.textPrimary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}>
          {sampleTimeLabel ?? '—'}
        </Text>
      </View>
      <View style={styles.sectionGap}>
        <View style={styles.sectionTitle}>
          <View style={styles.sectionTitleBar} />
          <Text style={styles.sectionTitleText}>Accelerometer (latest)</Text>
        </View>
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>axis_x</Text>
            <Text style={styles.metricValue}>{sample ? sample.accel.x.toFixed(2) : '—'}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>axis_y</Text>
            <Text style={styles.metricValue}>{sample ? sample.accel.y.toFixed(2) : '—'}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricLabel, styles.metricLabelSecondary]}>axis_z</Text>
            <Text style={styles.metricValue}>{sample ? sample.accel.z.toFixed(2) : '—'}</Text>
          </View>
        </View>
      </View>
    </>
  );
}

export function TwinGyroSections({ snapshot, styles }: { snapshot: ImuSnapshot; styles: TwinStyles }) {
  const n = snapshot.gyro_x.length;
  const i = Math.max(0, n - 1);
  const gx = n ? snapshot.gyro_x[i] : null;
  const gy = n ? snapshot.gyro_y[i] : null;
  const gz = n ? snapshot.gyro_z[i] : null;
  return (
    <View style={styles.sectionGap}>
      <View style={styles.sectionTitle}>
        <View style={[styles.sectionTitleBar, styles.sectionTitleBarWarn]} />
        <Text style={styles.sectionTitleText}>Gyroscope (latest)</Text>
      </View>
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>gyro_x</Text>
          <Text style={styles.metricValue}>{gx != null ? gx.toFixed(3) : '—'}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>gyro_y</Text>
          <Text style={styles.metricValue}>{gy != null ? gy.toFixed(3) : '—'}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricLabel, styles.metricLabelSecondary]}>gyro_z</Text>
          <Text style={styles.metricValue}>{gz != null ? gz.toFixed(3) : '—'}</Text>
        </View>
      </View>
    </View>
  );
}

function lastSampleAccelMagnitude(row: AlertEventRow): string {
  const s = row.snapshot;
  if (!s?.accel_x?.length) return '—';
  const i = s.accel_x.length - 1;
  const x = s.accel_x[i] ?? 0;
  const y = s.accel_y[i] ?? 0;
  const z = s.accel_z[i] ?? 0;
  return Math.sqrt(x * x + y * y + z * z).toFixed(2);
}

function eventTypeSeverity(eventType: string): 'default' | 'warn' | 'critical' {
  const t = eventType.toLowerCase();
  if (t.includes('impact')) return 'critical';
  if (t.includes('alert')) return 'critical';
  if (t.includes('aggressive') || t.includes('sharp') || t.includes('swerve')) return 'warn';
  return 'default';
}

function ImuSnapshotExpand({
  snapshot,
  styles,
}: {
  snapshot: ImuSnapshot | null;
  styles: TwinStyles;
}) {
  if (!snapshot?.accel_x?.length) {
    return (
      <Text style={styles.telemetryLogExpandEmpty}>No accelerometer / gyroscope snapshot on this row.</Text>
    );
  }
  const n = snapshot.accel_x.length;
  const i = n - 1;
  const ax = snapshot.accel_x[i] ?? 0;
  const ay = snapshot.accel_y[i] ?? 0;
  const az = snapshot.accel_z[i] ?? 0;
  const gx = snapshot.gyro_x[i] ?? 0;
  const gy = snapshot.gyro_y[i] ?? 0;
  const gz = snapshot.gyro_z[i] ?? 0;
  return (
    <View style={styles.telemetryLogExpand}>
      <Text style={styles.telemetryLogExpandMeta}>Samples: {n}</Text>
      <View style={styles.telemetryLogExpandBlock}>
        <Text style={styles.telemetryLogExpandCaption}>Accel</Text>
        <Text style={styles.telemetryLogExpandNums}>
          x {ax.toFixed(2)} · y {ay.toFixed(2)} · z {az.toFixed(2)}
        </Text>
      </View>
      <View style={styles.telemetryLogExpandBlock}>
        <Text style={styles.telemetryLogExpandCaption}>Gyroscope</Text>
        <Text style={styles.telemetryLogExpandNums}>
          x {gx.toFixed(3)} · y {gy.toFixed(3)} · z {gz.toFixed(3)}
        </Text>
      </View>
    </View>
  );
}

export function TwinEventLog({
  events,
  styles,
  colors,
}: {
  events: AlertEventRow[];
  styles: TwinStyles;
  colors: ThemeColors;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  if (events.length === 0) return null;
  return (
    <View style={styles.sectionGap}>
      <View style={styles.sectionTitle}>
        <View style={styles.sectionTitleBar} />
        <Text style={styles.sectionTitleText}>Telemetry · earlier events</Text>
      </View>
      <View style={styles.telemetryLogCard}>
        {events.map((row, idx) => {
          const sev = eventTypeSeverity(row.event_type);
          const typeColor =
            sev === 'critical' ? colors.danger : sev === 'warn' ? colors.warning : colors.textPrimary;
          const isOpen = !!open[row.eventKey];
          return (
            <View
              key={row.eventKey}
              style={[styles.telemetryLogRow, idx === 0 && styles.telemetryLogRowFirst]}
              accessibilityLabel={`${row.event_type} at ${row.eventKey}`}>
              <View style={styles.telemetryLogRowHeader}>
                <Text style={[styles.telemetryLogTimeRange, { color: typeColor }]} numberOfLines={1}>
                  {row.event_type}
                </Text>
                <Text style={styles.telemetryLogNominal}>|a| {lastSampleAccelMagnitude(row)}</Text>
              </View>
              <Text style={styles.ledgerTime}>
                {row.timestamp ? `${formatTimestampEstMmDdYyAnd24h(row.timestamp)} EST` : '—'}
              </Text>
              <View style={styles.telemetryLogMetaRow}>
                <Text style={styles.telemetryLogEvents} numberOfLines={1}>
                  {row.eventKey}
                </Text>
                <Pressable
                  onPress={() => toggle(row.eventKey)}
                  accessibilityRole="button"
                  accessibilityLabel={isOpen ? 'Collapse IMU details' : 'Expand IMU details'}
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityHint="Shows accelerometer and gyroscope samples from this row"
                  hitSlop={12}
                  style={({ pressed }) => [styles.telemetryLogToggleBtn, pressed && { opacity: 0.82 }]}>
                  <MaterialCommunityIcons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
              {isOpen ? <ImuSnapshotExpand snapshot={row.snapshot} styles={styles} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
