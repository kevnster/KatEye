import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { createDashboardStyles } from '@/features/dashboard/styles/index.styles';

import { TopBar } from '@/components/navigation/top-bar';
import { useAppTheme } from '@/context/theme';
import { dashboardMockData } from '@/features/dashboard/mock-data';
import { loadExamplePackageNode } from '@/features/firebase/load-package-node';
import type { HardwarePackageNode } from '@/features/firebase/hardware-payload';
import type { DashboardPackage, DashboardStat } from '@/features/dashboard/types';

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createDashboardStyles(colors), [colors]);
  const { heading, liveLink, stats, packages, alerts } = dashboardMockData;
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'connected' | 'failed'>('idle');
  const [connectionMessage, setConnectionMessage] = useState<string>('Tap to test Firebase.');
  const [packagePayload, setPackagePayload] = useState<HardwarePackageNode | null>(null);

  const statColor = (stat: DashboardStat) => {
    if (stat.kind === 'status') return colors.textPrimary;
    if (stat.tone === 'warning') return colors.warning;
    return colors.primary;
  };

  const packageTone = (status: DashboardPackage['status']) => {
    if (status === 'impact_detected') return '#F59E0B';
    if (status === 'warning') return '#DC2626';
    return '#2563EB';
  };

  const packageStatusLabel = (status: DashboardPackage['status']) => {
    if (status === 'impact_detected') return 'Impact Detected';
    if (status === 'warning') return 'Warning';
    return 'Safe';
  };

  const alertColor = (level: 'critical' | 'warning') => {
    if (level === 'critical') return colors.danger;
    return colors.warning;
  };

  const scoreToPercent = (score: string) => {
    const raw = Number.parseFloat(score);
    return Math.max(0, Math.min(raw * 100, 100));
  };

  const runFirebaseTest = useCallback(async () => {
    setConnectionStatus('checking');
    const result = await loadExamplePackageNode();
    if (!result.ok) {
      setConnectionStatus('failed');
      setConnectionMessage(result.message);
      setPackagePayload(null);
      return;
    }
    setConnectionStatus('connected');
    setConnectionMessage(
      result.source === 'fixture'
        ? 'fixture mode (bundled schema json, no rtdb).'
        : 'connected to rtdb.',
    );
    setPackagePayload(result.data);
  }, []);

  useEffect(() => {
    void runFirebaseTest();
  }, [runFirebaseTest]);

  return (
    <View style={styles.page}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.testCard}>
          <View style={styles.testHeader}>
            <Text style={styles.testTitle}>Firebase Connection</Text>
            <Text
              style={[
                styles.testStatus,
                connectionStatus === 'connected' && styles.testStatusOk,
                connectionStatus === 'failed' && styles.testStatusFail,
              ]}>
              {connectionStatus.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.testMessage}>{connectionMessage}</Text>
          <Pressable onPress={runFirebaseTest} style={styles.testButton}>
            <Text style={styles.testButtonText}>Run Test</Text>
          </Pressable>
          {packagePayload ? (
            <Text style={styles.payloadText}>{JSON.stringify(packagePayload, null, 2)}</Text>
          ) : null}
        </View>

        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heading}>{heading}</Text>
          </View>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{liveLink}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <View key={stat.id} style={styles.statCard}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <View style={styles.statValueRow}>
                <Text style={[styles.statValue, { color: statColor(stat) }]}>{stat.value}</Text>
                {stat.kind === 'status' ? (
                  <MaterialCommunityIcons name="shield-check" size={22} color={colors.success} />
                ) : null}
              </View>
              {stat.sub ? <Text style={styles.statSub}>{stat.sub}</Text> : null}
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Tracking</Text>
          <Text style={styles.sectionAction}>View All Assets</Text>
        </View>
        <View style={styles.packagesWrap}>
          {packages.map((pkg) => (
            <View key={pkg.id} style={styles.packageCard}>
              <View style={styles.packageMain}>
                <View style={[styles.packageIconWrap, { backgroundColor: `${packageTone(pkg.status)}20` }]}>
                  <MaterialCommunityIcons name="package-variant-closed" size={20} color={packageTone(pkg.status)} />
                </View>
                <View>
                  <Text style={styles.packageName}>{pkg.name}</Text>
                  <Text style={styles.packageId}>ID: {pkg.id}</Text>
                </View>
              </View>
              <View style={styles.packageMeta}>
                <View style={styles.locationRow}>
                  <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.locationText}>{pkg.location}</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${scoreToPercent(pkg.score)}%`,
                        backgroundColor: packageTone(pkg.status),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.damageText}>Score: {pkg.score}</Text>
              </View>
              <View style={styles.packageRight}>
                <Text style={[styles.statusPill, { color: packageTone(pkg.status), backgroundColor: `${packageTone(pkg.status)}20` }]}>
                  {packageStatusLabel(pkg.status)}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <MaterialCommunityIcons name="alert-outline" size={18} color={colors.danger} />
            <Text style={styles.alertTitle}>Actionable Alerts</Text>
          </View>
          {alerts.map((alert) => (
            <View key={alert.id} style={[styles.alertItem, { borderLeftColor: alertColor(alert.level) }]}>
              <Text style={[styles.alertType, { color: alertColor(alert.level) }]}>{alert.type}</Text>
              <Text style={styles.alertMessage}>{alert.message}</Text>
              <Text style={styles.alertTime}>{alert.time}</Text>
            </View>
          ))}
        </View>

        <View style={styles.mapCard}>
          <MapView
            style={styles.mapView}
            initialRegion={{
              latitude: 36.2,
              longitude: -119.4,
              latitudeDelta: 8.5,
              longitudeDelta: 8.5,
            }}>
            <Marker coordinate={{ latitude: 34.0522, longitude: -118.2437 }} title="Package Alpha" />
            <Marker coordinate={{ latitude: 37.7749, longitude: -122.4194 }} title="Package Beta" />
          </MapView>
          <View style={styles.mapFooter}>
            <Text style={styles.mapTitle}>Live Fleet Location</Text>
            <Text style={styles.mapSub}>Western US Corridor Active</Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

