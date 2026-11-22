import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Header } from '../../src/components/Header';
import { COLORS } from '../../src/constants/theme';
import * as trackerApi from '../../src/api/trackerApi';
import * as profileApi from '../../src/api/profileApi';
import { extractErrorMessage } from '../../src/api/client';
import {
  syncHealthConnect,
  getTodayStepsFromHealthConnect,
  SyncResult,
} from '../../src/services/healthConnectSync';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dailyLog, setDailyLog] = useState<trackerApi.DailyLog | null>(null);
  const [bmiData, setBmiData] = useState<profileApi.BmiResponse | null>(null);

  // Steps state
  const [stepsToday, setStepsToday] = useState<number>(0);
  const stepsGoal = 10000;

  // Health Connect sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Helper to extract steps from dailyLog workouts notes (e.g. "source:healthconnect - 7,420 steps")
  const extractStepsFromLog = (log: trackerApi.DailyLog | null): number => {
    if (!log?.workouts) return 0;
    for (const w of log.workouts) {
      if (w.notes && w.notes.includes('source:healthconnect')) {
        const match = w.notes.match(/([\d,]+)\s*steps/i);
        if (match) {
          const val = parseInt(match[1].replace(/,/g, ''), 10);
          if (!isNaN(val) && val > 0) return val;
        }
      }
    }
    return 0;
  };

  const fetchDashboardData = useCallback(async () => {
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Use allSettled to prevent single-endpoint failure / 429 from breaking entire dashboard
      const [logRes, bmiRes] = await Promise.allSettled([
        trackerApi.getDailyLog(today),
        profileApi.getBmi(),
      ]);

      if (logRes.status === 'fulfilled') {
        setDailyLog(logRes.value);
        const loggedSteps = extractStepsFromLog(logRes.value);
        if (loggedSteps > 0) {
          setStepsToday((prev) => Math.max(prev, loggedSteps));
        }
      }

      if (bmiRes.status === 'fulfilled') {
        setBmiData(bmiRes.value);
      }

      // On Android, also check direct live steps from Health Connect
      if (Platform.OS === 'android') {
        getTodayStepsFromHealthConnect()
          .then((hcSteps) => {
            if (hcSteps > 0) {
              setStepsToday((prev) => Math.max(prev, hcSteps));
            }
          })
          .catch(() => {});
      }
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleSyncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncHealthConnect();
      setSyncResult(result);
      if (result.success && result.stepsSynced > 0) {
        setStepsToday(result.stepsSynced);
      }
      if (result.success) {
        // Refresh dashboard metrics after sync
        fetchDashboardData();
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        stepsSynced: 0,
        sleepHoursSynced: 0,
        message: extractErrorMessage(err) || 'Sync failed. Please try again.',
      });
    } finally {
      setSyncing(false);
    }
  };

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

  const stepsPercent = Math.min(100, Math.round((stepsToday / stepsGoal) * 100));
  const estimatedKm = (stepsToday * 0.00076).toFixed(1);
  const estimatedCaloriesBurned = Math.round(stepsToday * 0.04);
  const estimatedActiveMins = Math.round(stepsToday / 100);

  return (
    <View style={styles.screen}>
      <Header
        title={`Hello, ${user?.first || 'Friend'} 👋`}
        subtitle={todayStr}
        rightAction={
          // Avatar → standalone /profile page (not a tab)
          <TouchableOpacity
            style={styles.avatarPill}
            onPress={() => router.push('/profile')}
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

            {/* ── Steps Card (Requested) ── */}
            <View style={styles.stepsCard}>
              <View style={styles.stepsTop}>
                <View style={styles.stepsHeaderLeft}>
                  <Text style={styles.stepsHeaderEmoji}>👟</Text>
                  <View>
                    <Text style={styles.stepsLabel}>DAILY STEPS</Text>
                    <Text style={styles.stepsGoalText}>
                      Goal: {stepsGoal.toLocaleString()} steps
                    </Text>
                  </View>
                </View>

                <View style={styles.stepsTopRight}>
                  <View style={styles.stepsPercentPill}>
                    <Text style={styles.stepsPercentText}>{stepsPercent}%</Text>
                  </View>
                  {Platform.OS === 'android' ? (
                    <TouchableOpacity
                      style={[styles.stepsSyncBtn, syncing && styles.stepsSyncBtnDisabled]}
                      onPress={handleSyncNow}
                      disabled={syncing}
                      activeOpacity={0.75}
                    >
                      {syncing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.stepsSyncBtnText}>Sync</Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Step Count Big Display */}
              <View style={styles.stepsCountRow}>
                <Text style={styles.stepsBigNumber}>
                  {stepsToday.toLocaleString()}
                </Text>
                <Text style={styles.stepsSubUnit}> / {stepsGoal.toLocaleString()}</Text>
              </View>

              {/* Progress Bar */}
              <View style={styles.stepsProgressBarBg}>
                <View
                  style={[
                    styles.stepsProgressBarFill,
                    { width: `${Math.max(4, stepsPercent)}%` },
                  ]}
                />
              </View>

              {/* Step Sub-metrics Chips */}
              <View style={styles.stepsChipsRow}>
                <View style={styles.stepsChip}>
                  <Text style={styles.stepsChipEmoji}>📍</Text>
                  <View>
                    <Text style={styles.stepsChipVal}>{estimatedKm} km</Text>
                    <Text style={styles.stepsChipSub}>Distance</Text>
                  </View>
                </View>

                <View style={styles.stepsChipDivider} />

                <View style={styles.stepsChip}>
                  <Text style={styles.stepsChipEmoji}>🔥</Text>
                  <View>
                    <Text style={styles.stepsChipVal}>{estimatedCaloriesBurned} kcal</Text>
                    <Text style={styles.stepsChipSub}>Active Burn</Text>
                  </View>
                </View>

                <View style={styles.stepsChipDivider} />

                <View style={styles.stepsChip}>
                  <Text style={styles.stepsChipEmoji}>⏱️</Text>
                  <View>
                    <Text style={styles.stepsChipVal}>{estimatedActiveMins} min</Text>
                    <Text style={styles.stepsChipSub}>Walking</Text>
                  </View>
                </View>
              </View>

              {/* Sync Feedback Message */}
              {syncResult ? (
                <View
                  style={[
                    styles.syncResultRow,
                    { backgroundColor: syncResult.success ? '#dcfce7' : '#fee2e2' },
                  ]}
                >
                  <Text
                    style={[
                      styles.syncResultText,
                      { color: syncResult.success ? '#15803d' : '#dc2626' },
                    ]}
                  >
                    {syncResult.success ? '✓ ' : '✗ '}
                    {syncResult.message}
                  </Text>
                </View>
              ) : null}
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

  // ── Steps Card Styles ──
  stepsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepsTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepsHeaderEmoji: {
    fontSize: 26,
  },
  stepsLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  stepsGoalText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  stepsTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepsPercentPill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  stepsPercentText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  stepsSyncBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 54,
    alignItems: 'center',
  },
  stepsSyncBtnDisabled: {
    backgroundColor: '#86efac',
  },
  stepsSyncBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  stepsCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  stepsBigNumber: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  stepsSubUnit: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginLeft: 6,
  },
  stepsProgressBarBg: {
    height: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 16,
  },
  stepsProgressBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 5,
  },
  stepsChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  stepsChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepsChipEmoji: {
    fontSize: 16,
  },
  stepsChipVal: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
  },
  stepsChipSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  stepsChipDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 4,
  },
  syncResultRow: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
  },
  syncResultText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },

  // ── Metrics Row ──
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

  // ── BMI Card ──
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
