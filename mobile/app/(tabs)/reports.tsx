import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { TopBar } from '@/components/navigation/top-bar';
import { useAppTheme } from '@/context/theme';
import { createSimpleTabScreenStyles } from '@/styles/simple-tab-screen.styles';

export default function ReportsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSimpleTabScreenStyles(colors), [colors]);

  return (
    <View style={styles.page}>
      <TopBar />
      <View style={styles.container}>
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.subtitle}>Incident and analytics reporting will appear here.</Text>
      </View>
    </View>
  );
}
