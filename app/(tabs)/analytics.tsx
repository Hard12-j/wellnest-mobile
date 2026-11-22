import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Header } from '../../src/components/Header';
import { COLORS } from '../../src/constants/theme';
import * as analyticsApi from '../../src/api/analyticsApi';
import { extractErrorMessage } from '../../src/api/client';

const getISODate = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDayName = (dateStr: string): string => {
  try {
    const parts = dateStr.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  } catch {
    return dateStr;
  }
};

export default function AnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trends, setTrends] = useState<analyticsApi.WeeklyTrendsResponse | null>(null);
  const [balance, setBalance] = useState<analyticsApi.CaloriesBalanceResponse | null>(null);
  const [goalProgress, setGoalProgress] = useState<analyticsApi.GoalProgressResponse | null>(null);
  const [goalCards, setGoalCards] = useState<analyticsApi.GoalCardProgressResponse | null>(null);
  const [insights, setInsights] = useState<analyticsApi.InsightItem[]>([]);

  const fetchAnalytics = useCallback(async () => {
    setError(null);
    const to = getISODate(0);
    const from = getISODate(6); // last 7 days

    const results = await Promise.allSettled([
      analyticsApi.getWeeklyTrends(from, to),
      analyticsApi.getCaloriesBalance(from, to),
      analyticsApi.getGoalProgress(),
      analyticsApi.getGoalCards(),
      analyticsApi.getInsights(),
    ]);

    const [trendsRes, balanceRes, goalsRes, cardsRes, insightsRes] = results;

    if (trendsRes.status === 'fulfilled') setTrends(trendsRes.value);
    if (balanceRes.status === 'fulfilled') setBalance(balanceRes.value);
    if (goalsRes.status === 'fulfilled') setGoalProgress(goalsRes.value);
    if (cardsRes.status === 'fulfilled') setGoalCards(cardsRes.value);
    if (insightsRes.status === 'fulfilled') setInsights(insightsRes.value.insights || []);

    const failed = results.flatMap((result, index) =>
      result.status === 'rejected'
        ? [`${['Weekly trends', 'Calorie balance', 'Goal progress', 'Goal cards', 'Insights'][index]}: ${extractErrorMessage(result.reason)}`]
        : []
    );
    if (failed.length === results.length) {
      setError(failed.join('\n'));
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAnalytics();
    }, [fetchAnalytics])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void fetchAnalytics();
  };

  // ── Compute 7-day aggregates from trends.days ──
  const trendDays = trends?.days || [];
  const metrics = useMemo(() => {
    if (!trendDays.length) {
      return {
        totalWorkouts: 0,
        totalWorkoutMins: 0,
        avgCaloriesBurned: 0,
        avgWaterMl: 0,
        avgSleep: 0,
        maxCalorieDay: 2000,
      };
    }
    const daysCount = trendDays.length;
    let totalWorkouts = 0;
    let totalWorkoutMins = 0;
    let totalBurned = 0;
    let totalWater = 0;
    let totalSleep = 0;
    let maxCal = 1000;

    for (const d of trendDays) {
      totalWorkouts += d.workoutCount || 0;
      totalWorkoutMins += d.workoutMinutes || 0;
      totalBurned += d.caloriesBurned || 0;
      totalWater += d.waterMl || 0;
      totalSleep += d.sleepHours || 0;
      if ((d.caloriesConsumed || 0) > maxCal) maxCal = d.caloriesConsumed;
      if ((d.caloriesBurned || 0) > maxCal) maxCal = d.caloriesBurned;
    }

    return {
      totalWorkouts,
      totalWorkoutMins,
      avgCaloriesBurned: Math.round(totalBurned / daysCount),
      avgWaterMl: Math.round(totalWater / daysCount),
      avgSleep: Number((totalSleep / daysCount).toFixed(1)),
      maxCalorieDay: maxCal,
    };
  }, [trendDays]);

  const streakDays = goalProgress?.currentStreakDays ?? 0;

  return (
    <View style={styles.screen}>
      <Header title="Analytics" subtitle="Performance, streaks, and smart insights" />

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
        {loading && !refreshing ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Compiling health trends...</Text>
          </View>
        ) : (
          <>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={() => { setRefreshing(true); void fetchAnalytics(); }} style={styles.retryButton}>
                  <Text style={styles.retryText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* ── 1. STREAK & WEIGHT HERO BANNER ── */}
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.heroSub}>WELLNESS JOURNEY</Text>
                  <Text style={styles.heroTitle}>
                    {goalProgress?.fitnessGoal || 'Stay Active & Healthy'}
                  </Text>
                </View>
                <View style={styles.streakBadge}>
                  <Text style={styles.streakText}>🔥 {streakDays} Day Streak</Text>
                </View>
              </View>

              <View style={styles.weightRow}>
                <View style={styles.weightCol}>
                  <Text style={styles.weightLabel}>CURRENT</Text>
                  <Text style={styles.weightVal}>
                    {goalProgress?.currentWeightKg ? `${goalProgress.currentWeightKg} kg` : '--'}
                  </Text>
                </View>
                <View style={styles.weightDivider} />
                <View style={styles.weightCol}>
                  <Text style={styles.weightLabel}>TARGET</Text>
                  <Text style={styles.weightVal}>
                    {goalProgress?.targetWeightKg ? `${goalProgress.targetWeightKg} kg` : '--'}
                  </Text>
                </View>
                <View style={styles.weightDivider} />
                <View style={styles.weightCol}>
                  <Text style={styles.weightLabel}>LAST 7 DAYS</Text>
                  <Text style={styles.weightVal}>
                    {goalProgress?.daysLoggedLast7 ?? 0}/7 days
                  </Text>
                </View>
              </View>

              {goalProgress?.progressPercent != null && goalProgress.progressPercent > 0 ? (
                <View style={styles.progressContainer}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>Goal Progress</Text>
                    <Text style={styles.progressPercent}>{Math.round(goalProgress.progressPercent)}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.min(100, Math.max(5, Math.round(goalProgress.progressPercent)))}%` },
                      ]}
                    />
                  </View>
                </View>
              ) : null}
            </View>

            {/* ── 2. REAL-TIME GOAL CARDS (Workouts, Water, Sleep) ── */}
            <Text style={styles.sectionTitle}>My Target Goals</Text>
            <View style={styles.goalCardsGrid}>
              {/* Workouts Card */}
              {goalCards?.workouts ? (
                <View style={styles.goalCardItem}>
                  <View style={styles.goalCardTop}>
                    <Text style={styles.goalCardEmoji}>🏋️</Text>
                    <View style={styles.goalPill}>
                      <Text style={styles.goalPillText}>{goalCards.workouts.badge || 'Goal'}</Text>
                    </View>
                  </View>
                  <Text style={styles.goalCardTitle}>Workouts</Text>
                  <Text style={styles.goalCardSub}>
                    {goalCards.workouts.completedDays} / {goalCards.workouts.targetDays} days
                  </Text>
                  <View style={styles.cardBarBg}>
                    <View
                      style={[
                        styles.cardBarFill,
                        {
                          width: `${Math.min(100, Math.max(5, goalCards.workouts.percentage))}%`,
                          backgroundColor: goalCards.workouts.percentage >= 100 ? '#10b981' : COLORS.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.goalCardTip}>{goalCards.workouts.tip}</Text>
                </View>
              ) : null}

              {/* Water Card */}
              {goalCards?.water ? (
                <View style={styles.goalCardItem}>
                  <View style={styles.goalCardTop}>
                    <Text style={styles.goalCardEmoji}>💧</Text>
                    <View style={[styles.goalPill, { backgroundColor: '#e0f2fe' }]}>
                      <Text style={[styles.goalPillText, { color: '#0369a1' }]}>{goalCards.water.badge || 'Goal'}</Text>
                    </View>
                  </View>
                  <Text style={styles.goalCardTitle}>Hydration</Text>
                  <Text style={styles.goalCardSub}>
                    {goalCards.water.currentLitres} / {goalCards.water.targetLitres} L
                  </Text>
                  <View style={styles.cardBarBg}>
                    <View
                      style={[
                        styles.cardBarFill,
                        {
                          width: `${Math.min(100, Math.max(5, goalCards.water.percentage))}%`,
                          backgroundColor: '#0284c7',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.goalCardTip}>{goalCards.water.tip}</Text>
                </View>
              ) : null}

              {/* Sleep Card */}
              {goalCards?.sleep ? (
                <View style={styles.goalCardItem}>
                  <View style={styles.goalCardTop}>
                    <Text style={styles.goalCardEmoji}>🌙</Text>
                    <View style={[styles.goalPill, { backgroundColor: '#f3e8ff' }]}>
                      <Text style={[styles.goalPillText, { color: '#7e22ce' }]}>{goalCards.sleep.badge || 'Goal'}</Text>
                    </View>
                  </View>
                  <Text style={styles.goalCardTitle}>Sleep</Text>
                  <Text style={styles.goalCardSub}>
                    {goalCards.sleep.avgHours.toFixed(1)} / {goalCards.sleep.targetHours} hrs
                  </Text>
                  <View style={styles.cardBarBg}>
                    <View
                      style={[
                        styles.cardBarFill,
                        {
                          width: `${Math.min(100, Math.max(5, goalCards.sleep.percentage))}%`,
                          backgroundColor: '#9333ea',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.goalCardTip}>{goalCards.sleep.tip}</Text>
                </View>
              ) : null}
            </View>

            {/* ── 3. WEEKLY SUMMARY STATS (Real Calculations) ── */}
            <Text style={styles.sectionTitle}>Weekly Summary (Last 7 Days)</Text>
            <View style={styles.gridRow}>
              <View style={[styles.statBox, { borderLeftColor: COLORS.primary }]}>
                <Text style={styles.statEmoji}>🏋️</Text>
                <Text style={styles.statVal}>{metrics.totalWorkouts}</Text>
                <Text style={styles.statLbl}>Total Workouts</Text>
                <Text style={styles.statSub}>{metrics.totalWorkoutMins} active mins</Text>
              </View>

              <View style={[styles.statBox, { borderLeftColor: COLORS.orange }]}>
                <Text style={styles.statEmoji}>🔥</Text>
                <Text style={styles.statVal}>{metrics.avgCaloriesBurned}</Text>
                <Text style={styles.statLbl}>Avg Burned / day</Text>
                <Text style={styles.statSub}>kcal / active day</Text>
              </View>

              <View style={[styles.statBox, { borderLeftColor: COLORS.info }]}>
                <Text style={styles.statEmoji}>💧</Text>
                <Text style={styles.statVal}>{metrics.avgWaterMl} ml</Text>
                <Text style={styles.statLbl}>Avg Water / day</Text>
                <Text style={styles.statSub}>{(metrics.avgWaterMl / 1000).toFixed(1)} L / day</Text>
              </View>

              <View style={[styles.statBox, { borderLeftColor: COLORS.purple }]}>
                <Text style={styles.statEmoji}>🌙</Text>
                <Text style={styles.statVal}>{metrics.avgSleep} hrs</Text>
                <Text style={styles.statLbl}>Avg Sleep / night</Text>
                <Text style={styles.statSub}>Target: 8.0 hrs</Text>
              </View>
            </View>

            {/* ── 4. 7-DAY ACTIVITY BREAKDOWN ── */}
            <Text style={styles.sectionTitle}>Daily Activity (Last 7 Days)</Text>
            <View style={styles.card}>
              <View style={styles.daysContainer}>
                {trendDays.map((d, index) => {
                  const dayLabel = getDayName(d.date);
                  const isLogged = d.logged || (d.workoutCount > 0) || (d.waterMl > 0) || (d.caloriesConsumed > 0);
                  const burnPct = Math.min(100, Math.round(((d.caloriesBurned || 0) / metrics.maxCalorieDay) * 100));
                  const consPct = Math.min(100, Math.round(((d.caloriesConsumed || 0) / metrics.maxCalorieDay) * 100));

                  return (
                    <View key={d.date || index} style={styles.dayCol}>
                      <View style={styles.dayBarsTrack}>
                        {/* Consumed bar */}
                        <View
                          style={[
                            styles.dayBarConsumed,
                            { height: `${Math.max(4, consPct)}%` },
                          ]}
                        />
                        {/* Burned bar */}
                        <View
                          style={[
                            styles.dayBarBurned,
                            { height: `${Math.max(4, burnPct)}%` },
                          ]}
                        />
                      </View>
                      <Text style={[styles.dayColLabel, isLogged && styles.dayColLabelActive]}>
                        {dayLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
                  <Text style={styles.legendText}>Consumed</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
                  <Text style={styles.legendText}>Burned</Text>
                </View>
              </View>
            </View>

            {/* ── 5. CALORIE BALANCE BREAKDOWN ── */}
            <Text style={styles.sectionTitle}>Calorie Balance (Last 7 Days)</Text>
            <View style={styles.card}>
              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceVal}>{Math.round(balance?.totalBurned ?? 0)}</Text>
                  <Text style={styles.balanceLbl}>Total Burned</Text>
                </View>
                <Text style={styles.balanceOperator}>-</Text>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceVal}>{Math.round(balance?.totalConsumed ?? 0)}</Text>
                  <Text style={styles.balanceLbl}>Total Consumed</Text>
                </View>
                <Text style={styles.balanceOperator}>=</Text>
                <View style={styles.balanceItem}>
                  <Text
                    style={[
                      styles.balanceVal,
                      { color: (balance?.totalNet ?? 0) <= 0 ? COLORS.primary : COLORS.danger },
                    ]}
                  >
                    {Math.round(balance?.totalNet ?? 0)}
                  </Text>
                  <Text style={styles.balanceLbl}>Net kcal</Text>
                </View>
              </View>
            </View>

            {/* ── 6. SMART AI COACHING INSIGHTS ── */}
            <Text style={styles.sectionTitle}>Smart Coaching Insights</Text>
            {insights.map((item, index) => {
              const isWarning = item.type === 'WARNING' || item.type === 'ALERT';
              return (
                <View
                  key={item.id || index}
                  style={[
                    styles.insightCard,
                    isWarning ? styles.insightWarning : styles.insightSuccess,
                  ]}
                >
                  <Text style={styles.insightEmoji}>
                    {isWarning ? '⚠️' : '💡'}
                  </Text>
                  <View style={styles.insightContent}>
                    <Text style={styles.insightTitle}>{item.title}</Text>
                    <Text style={styles.insightDesc}>{item.description}</Text>
                  </View>
                </View>
              );
            })}
            {insights.length === 0 && !loading ? (
              <View style={styles.card}>
                <Text style={styles.emptyInsights}>
                  Keep logging your daily meals, workouts, and sleep to generate smart personalized coaching insights!
                </Text>
              </View>
            ) : null}
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
    padding: 16,
    paddingTop: 8,
    paddingBottom: 32,
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
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
  },
  retryText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  heroCard: {
    backgroundColor: '#064e3b',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroSub: {
    fontSize: 10,
    fontWeight: '800',
    color: '#a7f3d0',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 2,
  },
  streakBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fed7aa',
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 14,
    paddingVertical: 12,
  },
  weightCol: {
    flex: 1,
    alignItems: 'center',
  },
  weightLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 2,
  },
  weightVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  weightDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  progressContainer: {
    marginTop: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    color: '#a7f3d0',
    fontWeight: '700',
  },
  progressPercent: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '800',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#34d399',
    borderRadius: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 4,
  },
  goalCardsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  goalCardItem: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  goalCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalCardEmoji: {
    fontSize: 20,
  },
  goalPill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  goalPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  goalCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  goalCardSub: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginTop: 2,
    marginBottom: 8,
  },
  cardBarBg: {
    height: 5,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  cardBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalCardTip: {
    fontSize: 10,
    color: COLORS.textMuted,
    lineHeight: 14,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  statVal: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  statLbl: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '700',
  },
  statSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingBottom: 8,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  dayBarsTrack: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    flex: 1,
    marginBottom: 6,
  },
  dayBarConsumed: {
    width: 6,
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  dayBarBurned: {
    width: 6,
    backgroundColor: '#f97316',
    borderRadius: 3,
  },
  dayColLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  dayColLabelActive: {
    color: COLORS.text,
    fontWeight: '800',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  balanceItem: {
    alignItems: 'center',
  },
  balanceVal: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  balanceLbl: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  balanceOperator: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  insightCard: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    gap: 12,
  },
  insightSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  insightWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  insightEmoji: {
    fontSize: 22,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 2,
  },
  insightDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  emptyInsights: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
