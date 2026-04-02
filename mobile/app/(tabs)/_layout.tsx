import { Tabs } from 'expo-router';
import React from 'react';

import { BottomNav } from '@/components/navigation/bottom-nav';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <BottomNav {...props} />}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Stats',
        }}
      />
      <Tabs.Screen
        name="digital-twin"
        options={{
          title: 'Digital Twin',
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Config',
        }}
      />
    </Tabs>
  );
}
