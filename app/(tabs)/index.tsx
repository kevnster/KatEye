import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { TopBar } from '@/components/navigation/top-bar';
import { dashboardMockData } from '@/features/dashboard/mock-data';
import type { DashboardPackage, DashboardStat } from '@/features/dashboard/types';

export default function HomeScreen() {
  // mock data now; swap to firebase provider later
  const { heading, liveLink, stats, packages, alerts } = dashboardMockData;

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

  return (
    <View style={styles.page}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
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

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 14,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  heading: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#334155',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  statCard: {
    width: '31%',
    minWidth: 104,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#64748B',
    fontWeight: '600',
  },
  statValueRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  statSub: {
    marginTop: 3,
    color: '#64748B',
    fontSize: 8,
  },
  sectionHeader: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    color: '#0F172A',
    fontWeight: '800',
  },
  sectionAction: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '600',
  },
  packagesWrap: {
    gap: 10,
  },
  packageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  packageMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  packageIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageName: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '700',
  },
  packageId: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
  },
  packageMeta: {
    gap: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    color: '#475569',
    fontSize: 12,
  },
  progressTrack: {
    height: 6,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  damageText: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#64748B',
    fontWeight: '700',
  },
  packageRight: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  alertCard: {
    marginTop: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 14,
    gap: 10,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertTitle: {
    fontSize: 18,
    color: '#0F172A',
    fontWeight: '800',
  },
  alertItem: {
    borderLeftWidth: 2,
    paddingLeft: 10,
    gap: 4,
  },
  alertType: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '800',
  },
  alertMessage: {
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 20,
  },
  alertTime: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  mapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  mapView: {
    height: 170,
  },
  mapFooter: {
    padding: 12,
  },
  mapTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  mapSub: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
  },
});
