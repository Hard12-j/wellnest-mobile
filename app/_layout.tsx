import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { COLORS } from '../src/constants/theme';
import { ChatProvider, useChat } from '../src/context/ChatContext';

function NavigationGuard() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect unauthenticated user to login
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect logged in user to main tabs
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>🌿</Text>
        </View>
        <Text style={styles.splashTitle}>WellNest</Text>
        <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const showChatShortcut = isAuthenticated && segments[0] === '(tabs)' && !segments.join('/').includes('chat');

  return (
    <ChatProvider>
      <StatusBar style="dark" />
      <View style={styles.appShell}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="chat" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ headerShown: false }} />
        </Stack>
        {showChatShortcut ? <ChatShortcut /> : null}
      </View>
    </ChatProvider>
  );
}

function ChatShortcut() {
  const { unreadCount } = useChat();
  const router = useRouter();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0 ? `Open chat, ${unreadCount} unread messages` : 'Open chat'}
      activeOpacity={0.85}
      style={styles.chatShortcut}
      onPress={() => router.push('/chat')}
    >
      <Text style={styles.chatShortcutIcon}>💬</Text>
      {unreadCount > 0 ? (
        <View style={styles.chatUnreadBadge}>
          <Text style={styles.chatUnreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NavigationGuard />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  appShell: { flex: 1 },
  chatShortcut: {
    position: 'absolute',
    right: 18,
    bottom: 82,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: '#ffffff',
    elevation: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
  },
  chatShortcutIcon: { fontSize: 25 },
  chatUnreadBadge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  chatUnreadText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
  splash: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2,
    borderColor: COLORS.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: {
    fontSize: 40,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginTop: 14,
  },
});
