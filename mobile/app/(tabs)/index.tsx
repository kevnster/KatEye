import { MaterialCommunityIcons } from '@expo/vector-icons';
import { get, ref } from 'firebase/database';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { styles } from '@/features/dashboard/styles/index.styles';

import { TopBar } from '@/components/navigation/top-bar';
import { dashboardMockData } from '@/features/dashboard/mock-data';
import { rtdb } from '@/features/firebase/client';
import type { DashboardPackage, DashboardStat } from '@/features/dashboard/types';

export default function HomeScreen() {
  // mock data now; swap to firebase provider later
  const { heading, liveLink, stats, packages, alerts } = dashboardMockData;
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'connected' | 'failed'>('idle');
  const [connectionMessage, setConnectionMessage] = useState<string>('Tap to test Firebase.');
  const [latestPayload, setLatestPayload] = useState<unknown>(null);

  const statColor = (stat: DashboardStat) => {
    if (stat.kind === 'status') return '#0F172A';
    if (stat.tone === 'warning') return '#F59E0B';
    return '#2563EB';
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
    if (level === 'critical') return '#DC2626';
    return '#F59E0B';
  };

  const scoreToPercent = (score: string) => {
    const raw = Number.parseFloat(score);
    // score is expected in 0.00-1.00 range
    return Math.max(0, Math.min(raw * 100, 100));
  };

  const runFirebaseTest = useCallback(async () => {
    try {
      setConnectionStatus('checking');
      const snapshot = await get(ref(rtdb, 'demo/latest'));

      if (!snapshot.exists()) {
        setConnectionStatus('failed');
        setConnectionMessage("Connected, but 'demo/latest' has no data.");
        setLatestPayload(null);
        return;
      }

      setConnectionStatus('connected');
      setConnectionMessage('Connected to Realtime Database.');
      setLatestPayload(snapshot.val());
    } catch (error) {
      setConnectionStatus('failed');
      setConnectionMessage(error instanceof Error ? error.message : 'Unknown Firebase error.');
      setLatestPayload(null);
    }
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
          {latestPayload ? (
            <Text style={styles.payloadText}>{JSON.stringify(latestPayload, null, 2)}</Text>
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
                  <MaterialCommunityIcons name="shield-check" size={22} color="#10B981" />
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
                  <MaterialCommunityIcons name="map-marker-outline" size={14} color="#64748B" />
                  <Text style={styles.locationText}>{pkg.location}</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    // clamp defends against bad mock/source values
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
                <MaterialCommunityIcons name="chevron-right" size={20} color="#64748B" />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <MaterialCommunityIcons name="alert-outline" size={18} color="#DC2626" />
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

