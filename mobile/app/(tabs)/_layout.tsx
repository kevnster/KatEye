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
          title: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="tracking"
        options={{
          title: 'Tracking',
        }}
      />
      <Tabs.Screen
        name="keys"
        options={{
          title: 'Keys',
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
        }}
      />
    </Tabs>
  );
}
