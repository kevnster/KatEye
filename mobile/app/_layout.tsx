import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AlertsEventsProvider } from '@/context/alerts-events';
import { DisplayPreferencesProvider } from '@/context/display-preferences';
import { AppThemeProvider, useAppTheme } from '@/context/theme';
import { AppNavigationDark, AppNavigationLight } from '@/styles/navigation-theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <DisplayPreferencesProvider>
        <AlertsEventsProvider>
          <RootNav />
        </AlertsEventsProvider>
      </DisplayPreferencesProvider>
    </AppThemeProvider>
  );
}

function RootNav() {
  const { scheme } = useAppTheme();

  return (
    <ThemeProvider value={scheme === 'dark' ? AppNavigationDark : AppNavigationLight}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
