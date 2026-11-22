import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Header } from '../../src/components/Header';
import { COLORS } from '../../src/constants/theme';
import * as trackerApi from '../../src/api/trackerApi';
import * as profileApi from '../../src/api/profileApi';
import { extractErrorMessage } from '../../src/api/client';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dailyLog, setDailyLog] = useState<trackerApi.DailyLog | null>(null);
  const [bmiData, setBmiData] = useState<profileApi.BmiResponse | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [log, bmi] = await Promise.all([
        trackerApi.getDailyLog(today).catch(() => null),
        profileApi.getBmi().catch(() => null),
      ]);
      setDailyLog(log);
      setBmiData(bmi);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={styles.screen}>
      <Header
        title={`Hello, ${user?.first || 'Friend'} 👋`}
        subtitle={todayStr}
        rightAction={
          <TouchableOpacity
            style={styles.avatarPill}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={styles.avatarText}>
              {(user?.first?.[0] || 'U').toUpperCase()}
            </Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchDashboardData} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading && !refreshing ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Fetching your daily stats...</Text>
          </View>
        ) : (
          <>
            {/* ── Calorie Summary Card ── */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <Text style={styles.summaryLabel}>TODAY'S ENERGY BALANCE</Text>
                <View style={styles.netPill}>
                  <Text style={styles.netPillText}>
                    Net: {dailyLog?.netCalories ?? 0} kcal
                  </Text>
                </View>
              </View>

              <View style={styles.calorieRow}>
                <View style={styles.calorieItem}>
                  <Text style={styles.calorieIcon}>🔥</Text>
                  <Text style={styles.calorieValue}>
                    {dailyLog?.caloriesBurned ?? 0}
                  </Text>
                  <Text style={styles.calorieDesc}>Burned (kcal)</Text>
                </View>

                <View style={styles.calorieDivider} />

                <View style={styles.calorieItem}>
                  <Text style={styles.calorieIcon}>🥗</Text>
                  <Text style={styles.calorieValue}>
                    {dailyLog?.caloriesConsumed ?? 0}
                  </Text>
                  <Text style={styles.calorieDesc}>Consumed (kcal)</Text>
                </View>
              </View>
            </View>

            {/* ── Secondary Metrics (Hydration & Sleep) ── */}
            <View style={styles.metricsRow}>
              <View style={[styles.metricCard, { borderLeftColor: COLORS.info }]}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricEmoji}>💧</Text>
                  <Text style={styles.metricLabel}>Water</Text>
                </View>
                <Text style={styles.metricValue}>
                  {dailyLog?.hydrationMl ?? 0}
                  <Text style={styles.metricUnit}> ml</Text>
                </Text>
                <Text style={styles.metricSub}>Goal: 2,500 ml</Text>
              </View>

              <View style={[styles.metricCard, { borderLeftColor: COLORS.purple }]}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricEmoji}>🌙</Text>
                  <Text style={styles.metricLabel}>Sleep</Text>
                </View>
                <Text style={styles.metricValue}>
                  {dailyLog?.sleepHours ?? 0}
                  <Text style={styles.metricUnit}> hrs</Text>
                </Text>
                <Text style={styles.metricSub}>
                  {dailyLog?.sleep?.quality ? `Quality: ${dailyLog.sleep.quality}/5 ★` : 'Goal: 8.0 hrs'}
                </Text>
              </View>
            </View>

            {/* ── Health Connect Quick Sync Banner ── */}
            <TouchableOpacity
              style={styles.syncBanner}
              onPress={() => router.push('/(tabs)/sync')}
              activeOpacity={0.85}
            >
              <View style={styles.syncBannerLeft}>
                <Text style={styles.syncEmoji}>⌚</Text>
                <View>
                  <Text style={styles.syncTitle}>Health Connect Integration</Text>
                  <Text style={styles.syncSub}>
                    Read steps and sleep from your phone or watch
                  </Text>
                </View>
              </View>
              <Text style={styles.syncArrow}>→</Text>
            </TouchableOpacity>

            {/* ── BMI & Wellness Guidance ── */}
            {bmiData ? (
              <View style={styles.bmiCard}>
                <View style={styles.bmiTop}>
                  <Text style={styles.bmiLabel}>BODY MASS INDEX (BMI)</Text>
                  <View style={styles.bmiCategoryPill}>
                    <Text style={styles.bmiCategoryText}>{bmiData.category}</Text>
                  </View>
                </View>
                <Text style={styles.bmiNumber}>{bmiData.bmi?.toFixed(1) ?? '--'}</Text>
                <Text style={styles.bmiGuidance}>{bmiData.guidance}</Text>
              </View>
            ) : null}

            {/* ── Quick Action Buttons ── */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/(tabs)/tracker')}
              >
                <Text style={styles.actionEmoji}>🏋️</Text>
                <Text style={styles.actionText}>Log Workout</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/(tabs)/tracker')}
              >
                <Text style={styles.actionEmoji}>🍎</Text>
                <Text style={styles.actionText}>Auto Meal ✨</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/(tabs)/tracker')}
              >
                <Text style={styles.actionEmoji}>💧</Text>
                <Text style={styles.actionText}>Add Water</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/(tabs)/tracker')}
              >
                <Text style={styles.actionEmoji}>😴</Text>
                <Text style={styles.actionText}>Log Sleep</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
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
    padding: 20,
    paddingTop: 8,
  },
  avatarPill: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  centerLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  errorBanner: {
    backgroundColor: COLORS.dangerLight,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  retryBtn: {
    marginLeft: 12,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  netPill: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  netPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calorieItem: {
    flex: 1,
    alignItems: 'center',
  },
  calorieIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  calorieValue: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
  },
  calorieDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  calorieDivider: {
    width: 1,
    height: 48,
    backgroundColor: COLORS.border,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  metricEmoji: {
    fontSize: 16,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  metricUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  metricSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  syncBanner: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  syncBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  syncEmoji: {
    fontSize: 28,
  },
  syncTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e40af',
  },
  syncSub: {
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 2,
  },
  syncArrow: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1e40af',
    marginLeft: 8,
  },
  bmiCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bmiTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bmiLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  bmiCategoryPill: {
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bmiCategoryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },
  bmiNumber: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 4,
  },
  bmiGuidance: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  actionBtn: {
    width: '48%',
    backgroundColor: COLORS.card,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
});
