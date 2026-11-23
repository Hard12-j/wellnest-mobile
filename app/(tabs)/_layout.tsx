import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { COLORS } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';

export default function TabsLayout() {
  const { user } = useAuth();
  const isTrainer = user?.role === 'TRAINER';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text> }} />
      <Tabs.Screen name="tracker" options={{ title: 'Tracker', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🔥</Text> }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analytics', tabBarIcon: () => <Text style={{ fontSize: 20 }}>📊</Text> }} />
      <Tabs.Screen name="community" options={{ title: 'Community', tabBarIcon: () => <Text style={{ fontSize: 20 }}>👥</Text> }} />
      {isTrainer ? (
        <Tabs.Screen name="clients" options={{ title: 'Clients', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🧑‍🤝‍🧑</Text> }} />
      ) : (
        <Tabs.Screen name="trainers" options={{ title: 'Trainers', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏋️</Text> }} />
      )}
    </Tabs>
  );
}
