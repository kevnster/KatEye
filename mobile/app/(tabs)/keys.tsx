import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { TopBar } from '@/components/navigation/top-bar';
import { useAppTheme } from '@/context/theme';
import { createSimpleTabScreenStyles } from '@/styles/simple-tab-screen.styles';

export default function KeysScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSimpleTabScreenStyles(colors), [colors]);

  return (
    <View style={styles.page}>
      <TopBar />
      <View style={styles.container}>
        <Text style={styles.title}>Keys</Text>
        <Text style={styles.subtitle}>Key assignment and ownership details go here.</Text>
      </View>
    </View>
  );
}
