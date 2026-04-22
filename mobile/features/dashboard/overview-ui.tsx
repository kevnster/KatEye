import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { resolveEventTypeColor } from '@/features/dashboard/event-type-colors';
import type { DashboardStyles } from '@/features/dashboard/styles/index.styles';
import type { DashboardAlert, DashboardPackage, DashboardStat, FleetActivityModel } from '@/features/dashboard/types';
import type { ThemeColors } from '@/styles/app-theme';

type StatPalette = { statValueColor: (stat: DashboardStat) => string };

export function DashboardStatsGrid({
  stats,
  styles,
  colors,
  palette,
}: {
  stats: DashboardStat[];
  styles: DashboardStyles;
  colors: ThemeColors;
  palette: StatPalette;
}) {
  return (
    <View style={styles.statsGrid}>
      {stats.map((stat) => (
        <View key={stat.id} style={styles.statCard}>
          <Text style={styles.statLabel}>{stat.label}</Text>
          <View style={styles.statValueRow}>
            <Text
              style={[styles.statValue, { color: palette.statValueColor(stat) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}>
              {stat.value}
            </Text>
            {stat.kind === 'status' ? (
              <MaterialCommunityIcons name="shield-check" size={22} color={colors.success} />
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

export function FleetActivityStrip({
  activity,
  colors,
  styles,
  selectedBucket,
  onSelectBucket,
}: {
  activity: FleetActivityModel;
  colors: ThemeColors;
  styles: DashboardStyles;
  selectedBucket: number | null;
  onSelectBucket: (hourIndex: number | null) => void;
}) {
  const [trackW, setTrackW] = useState(0);
  const palette = [colors.primary, colors.warning, colors.success, colors.danger, colors.navActive, colors.textMuted];

  return (
    <View style={styles.activitySection}>
      <Text style={styles.activityCaption}>Last 24h · tap a segment to filter devices</Text>
      <View
        style={styles.activityTrack}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width || 0)}>
        <View style={styles.activityBaseline} />
        {trackW > 0
          ? activity.ticks.map((t) => {
              const left = Math.max(0, Math.min(trackW - 3, t.x * trackW - 1.5));
              const c = palette[t.deviceId.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % palette.length];
              return (
                <View
                  key={t.eventKey}
                  style={[styles.activityDot, { left, backgroundColor: c, opacity: 0.92 }]}
                  pointerEvents="none"
                />
              );
            })
          : null}
        <View style={styles.activityHitRow} pointerEvents="box-none">
          {activity.hourBuckets.map((b) => (
            <Pressable
              key={b.index}
              accessibilityLabel={`Hour ${b.index + 1}, events ${b.count}`}
              style={[styles.activityHitCell, selectedBucket === b.index && styles.activityHitCellSelected]}
              onPress={() => onSelectBucket(selectedBucket === b.index ? null : b.index)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

type Conn = 'idle' | 'loading' | 'ready' | 'error';

function connLabel(s: Conn) {
  if (s === 'loading') return 'LOADING';
  if (s === 'ready') return 'READY';
  if (s === 'error') return 'ERROR';
  return 'IDLE';
}

export function TelemetrySourceCard({
  status,
  message,
  onRefresh,
  styles,
}: {
  status: Conn;
  message: string | null | undefined;
  onRefresh: () => void;
  styles: DashboardStyles;
}) {
  return (
    <View style={styles.testCard}>
      <View style={styles.testHeader}>
        <Text style={styles.testTitle}>Firebase · alerts</Text>
        <Text
          style={[
            styles.testStatus,
            status === 'ready' && styles.testStatusOk,
            status === 'error' && styles.testStatusFail,
          ]}>
          {connLabel(status)}
        </Text>
      </View>
      <Text style={styles.testMessage}>{message ?? 'Checking alerts…'}</Text>
      <Pressable onPress={onRefresh} style={styles.testButton}>
        <Text style={styles.testButtonText}>Refresh</Text>
      </Pressable>
    </View>
  );
}

type PkgPalette = {
  packageAccent: (status: DashboardPackage['status']) => string;
  packageStatusLabel: (status: DashboardPackage['status']) => string;
};

export function TrackedPackageCard({
  pkg,
  styles,
  colors,
  palette,
  onOpenDigitalTwin,
}: {
  pkg: DashboardPackage;
  styles: DashboardStyles;
  colors: ThemeColors;
  palette: PkgPalette;
  onOpenDigitalTwin: () => void;
}) {
  const tone = palette.packageAccent(pkg.status);
  return (
    <Pressable
      onPress={onOpenDigitalTwin}
      style={({ pressed }) => [styles.packageCard, pressed && { opacity: 0.92 }]}
      android_ripple={{ color: `${colors.primary}22` }}>
      <View style={styles.packageMain}>
        <View style={[styles.packageIconWrap, { backgroundColor: `${tone}20` }]}>
          <MaterialCommunityIcons name="package-variant-closed" size={20} color={tone} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.packageName}>{pkg.name}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
      </View>
      <View style={styles.packageMeta}>
        <View style={styles.packageInfoRow}>
          <View style={styles.packageInfoIconCol}>
            <MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.textMuted} />
          </View>
          <View style={styles.packageInfoBody}>
            <Text style={styles.packageLocationInline} numberOfLines={1}>
              {pkg.locationLabel}
            </Text>
          </View>
        </View>
        <View style={styles.packageInfoRow}>
          <View style={styles.packageInfoIconCol}>
            <MaterialCommunityIcons name="flash-outline" size={12} color={colors.textMuted} />
          </View>
          <View style={styles.packageInfoBody}>
            <View style={styles.packageInfoLabelSlot}>
              <Text style={styles.packageMetaLabel}>Last:</Text>
            </View>
            <Text style={styles.packageInfoValueLine} numberOfLines={2}>
              <Text style={[styles.packageInfoType, { color: resolveEventTypeColor(pkg.lastEventType, colors) }]}>
                {pkg.lastEventType}
              </Text>
              <Text style={styles.packageInfoMutedSmall}> · {pkg.lastEventRelative}</Text>
            </Text>
          </View>
        </View>
        <View style={styles.packageInfoRow}>
          <View style={styles.packageInfoIconCol}>
            <MaterialCommunityIcons name="clock-outline" size={12} color={colors.textMuted} />
          </View>
          <View style={styles.packageInfoBody}>
            <View style={styles.packageInfoLabelSlot}>
              <Text style={styles.packageMetaLabel}>First:</Text>
            </View>
            <Text style={styles.packageInfoValueLine} numberOfLines={2}>
              <Text style={[styles.packageInfoType, { color: resolveEventTypeColor(pkg.firstEventType, colors) }]}>
                {pkg.firstEventType}
              </Text>
              <Text style={styles.packageInfoMutedSmall}> · {pkg.firstEventRelative}</Text>
            </Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: pkg.status === 'safe' ? '32%' : '78%', backgroundColor: tone },
            ]}
          />
        </View>
        <View style={styles.packageRight}>
          <Text style={[styles.statusPill, { color: tone, backgroundColor: `${tone}20` }]}>
            {palette.packageStatusLabel(pkg.status)}
          </Text>
          <Text style={styles.damageText}>Events: {pkg.score}</Text>
        </View>
      </View>
    </Pressable>
  );
}

type AlertPal = { alertAccent: (level: DashboardAlert['level']) => string };

export function CriticalWindowsSection({
  alerts,
  styles,
  palette,
  compact = false,
}: {
  alerts: DashboardAlert[];
  styles: DashboardStyles;
  palette: AlertPal;
  compact?: boolean;
}) {
  const cardStyle = compact ? [styles.alertCard, styles.alertCardCompact] : styles.alertCard;
  const titleStyle = compact ? [styles.alertTitle, styles.alertTitleCompact] : styles.alertTitle;
  const messageStyle = compact ? [styles.alertMessage, styles.alertMessageCompact] : styles.alertMessage;

  return (
    <View style={cardStyle}>
      <View style={styles.alertHeader}>
        <MaterialCommunityIcons
          name="alert-outline"
          size={compact ? 16 : 18}
          color={palette.alertAccent('critical')}
        />
        <Text style={titleStyle}>Critical windows</Text>
      </View>
      {alerts.length === 0 ? (
        <Text style={messageStyle}>No impact-type events.</Text>
      ) : (
        alerts.map((alert) => (
          <View key={alert.id} style={[styles.alertItem, { borderLeftColor: palette.alertAccent(alert.level) }]}>
            <Text style={[styles.alertType, { color: palette.alertAccent(alert.level) }]}>{alert.type}</Text>
            <Text style={styles.alertMessage}>{alert.message}</Text>
            <Text style={styles.alertTime}>{alert.time}</Text>
          </View>
        ))
      )}
    </View>
  );
}
