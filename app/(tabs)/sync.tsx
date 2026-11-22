import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { COLORS } from '../../src/constants/theme';
import { syncHealthConnect, SyncResult } from '../../src/services/healthConnectSync';

export default function SyncScreen() {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await syncHealthConnect();
      setLastSyncResult(res);
      setLastSyncTime(new Date().toLocaleTimeString());

      if (res.success) {
        Alert.alert('Sync Complete! ⌚', res.message);
      } else {
        Alert.alert('Sync Notice', res.message);
      }
    } catch (err: any) {
      Alert.alert('Sync Error', err?.message || 'Failed to sync with Health Connect.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Header
        title="Health Connect"
        subtitle="Automatic physical sensor & wearable sync"
      />

      <ScrollView contentContainerStyle={styles.container}>
        {/* ── Main Sync Card ── */}
        <View style={styles.heroCard}>
          <View style={styles.iconCircle}>
            <Text style={styles.watchIcon}>⌚</Text>
          </View>

          <Text style={styles.heroTitle}>Physical Device Sync</Text>
          <Text style={styles.heroSub}>
            Seamlessly fetch physical steps and sleep sessions from Android Health Connect (Google Fit, Samsung Health, Pixel Watch, Garmin, etc.) and save them directly to your WellNest cloud account.
          </Text>

          <Button
            title={syncing ? 'Syncing...' : 'Sync Now 🔄'}
            onPress={handleSyncNow}
            loading={syncing}
            style={styles.syncBtn}
          />

          {lastSyncTime ? (
            <Text style={styles.lastSyncText}>Last synced at {lastSyncTime}</Text>
          ) : null}
        </View>

        {/* ── Sync Results Preview ── */}
        {lastSyncResult ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultHeader}>LAST SYNC SUMMARY</Text>

            <View style={styles.resultRow}>
              <View style={styles.resultItem}>
                <Text style={styles.resultEmoji}>👣</Text>
                <Text style={styles.resultNum}>
                  {lastSyncResult.stepsSynced.toLocaleString()}
                </Text>
                <Text style={styles.resultLbl}>Steps Synced</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.resultItem}>
                <Text style={styles.resultEmoji}>🌙</Text>
                <Text style={styles.resultNum}>
                  {lastSyncResult.sleepHoursSynced} hrs
                </Text>
                <Text style={styles.resultLbl}>Sleep Synced</Text>
              </View>
            </View>

            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{lastSyncResult.message}</Text>
            </View>
          </View>
        ) : null}

        {/* ── How It Works Info Card ── */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How Syncing Works</Text>
          <Text style={styles.infoBullet}>
            • <Text style={styles.bold}>Steps</Text>: Health Connect aggregates steps recorded by your phone or connected smartwatch and creates a walking activity in WellNest.
          </Text>
          <Text style={styles.infoBullet}>
            • <Text style={styles.bold}>Sleep</Text>: Reads your sleep session duration and logs it in your sleep tracker.
          </Text>
          <Text style={styles.infoBullet}>
            • <Text style={styles.bold}>Idempotent</Text>: Repeating the sync will never create duplicate workouts or sleep entries for the same day.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    padding: 16,
    paddingTop: 8,
  },
  heroCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: COLORS.primaryBorder,
  },
  watchIcon: {
    fontSize: 32,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  syncBtn: {
    width: '100%',
    paddingVertical: 14,
  },
  lastSyncText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 10,
  },
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  resultHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  resultItem: {
    flex: 1,
    alignItems: 'center',
  },
  resultEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  resultNum: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  resultLbl: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 44,
    backgroundColor: COLORS.border,
  },
  statusPill: {
    backgroundColor: COLORS.surface,
    padding: 10,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 10,
  },
  infoBullet: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  bold: {
    fontWeight: '700',
    color: COLORS.text,
  },
});
