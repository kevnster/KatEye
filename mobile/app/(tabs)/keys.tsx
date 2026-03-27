import { StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/navigation/top-bar';

export default function KeysScreen() {
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

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
});
