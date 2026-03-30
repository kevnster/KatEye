import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LandingScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.background}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />
      </View>

      <View style={styles.content}>
        <View style={styles.brandBlock}>
          <Text style={styles.brandTitle}>
            <Text style={styles.brandPrimary}>Kat</Text>
            <Text style={styles.brandAccent}>Eye</Text>
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSubtitle}>Access your logistics dashboard.</Text>

          <Pressable style={styles.primaryButton} onPress={() => router.replace('/(tabs)')}>
            <MaterialCommunityIcons name="email-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Sign in with Email</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => router.replace('/(tabs)')}>
            <MaterialCommunityIcons name="google" size={18} color="#111827" />
            <Text style={styles.secondaryButtonText}>Continue with Google</Text>
          </Pressable>

          <Pressable style={styles.helpButton}>
            <Text style={styles.helpText}>Trouble logging in?</Text>
            <MaterialCommunityIcons name="arrow-right" size={14} color="#64748B" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B1220',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  // soft glows keep the screen from feeling flat
  glowTop: {
    position: 'absolute',
    top: -120,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(37, 99, 235, 0.28)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -140,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 28,
  },
  brandBlock: {
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  brandPrimary: {
    color: '#E5E7EB',
  },
  brandAccent: {
    color: '#60A5FA',
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    gap: 12,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: '#CBD5E1',
    fontSize: 13,
    marginBottom: 8,
  },
  primaryButton: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 14,
  },
  helpButton: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  helpText: {
    color: '#94A3B8',
    fontSize: 12,
  },
});
