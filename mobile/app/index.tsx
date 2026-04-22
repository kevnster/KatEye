import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenFade } from '@/components/animation/screen-fade';
import { useAppTheme } from '@/context/theme';
import { createLandingStyles } from '@/styles/landing.styles';

export default function LandingScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createLandingStyles(colors), [colors]);

  return (
    <ScreenFade>
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
              <MaterialCommunityIcons name="email-outline" size={18} color={colors.onPrimary} />
              <Text style={styles.primaryButtonText}>Sign in with Email</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={() => router.replace('/(tabs)')}>
              <MaterialCommunityIcons name="google" size={18} color={colors.textPrimary} />
              <Text style={styles.secondaryButtonText}>Continue with Google</Text>
            </Pressable>

            <Pressable style={styles.helpButton}>
              <Text style={styles.helpText}>Trouble logging in?</Text>
              <MaterialCommunityIcons name="arrow-right" size={14} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </ScreenFade>
  );
}
