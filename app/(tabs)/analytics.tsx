import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Header } from '../../src/components/Header';
import { COLORS } from '../../src/constants/theme';
import * as analyticsApi from '../../src/api/analyticsApi';
import { extractErrorMessage } from '../../src/api/client';

export default function AnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trends, setTrends] = useState<analyticsApi.WeeklyTrendsResponse | null>(null);
  const [balance, setBalance] = useState<analyticsApi.CaloriesBalanceResponse | null>(null);
  const [goalProgress, setGoalProgress] = useState<analyticsApi.GoalProgressResponse | null>(null);
  const [insights, setInsights] = useState<analyticsApi.InsightItem[]>([]);

  const fetchAnalytics = useCallback(async () => {
    setError(null);
    try {
      const [tRes, bRes, gRes, iRes] = await Promise.all([
        analyticsApi.getWeeklyTrends().catch(() => null),
        analyticsApi.getCaloriesBalance().catch(() => null),
        analyticsApi.getGoalProgress().catch(() => null),
        analyticsApi.getInsights().catch(() => null),
      ]);
      setTrends(tRes);
      setBalance(bRes);
      setGoalProgress(gRes);
      setInsights(iRes?.insights || []);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

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
              </View>
            ) : null}

            {/* ── Streak & Goals Card ── */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardLabel}>GOAL & STREAK TRACKER</Text>
                <View style={styles.streakBadge}>
                  <Text style={styles.streakText}>
                    🔥 {goalProgress?.streakDays ?? 0} Day Streak
                  </Text>
                </View>
              </View>

              <View style={styles.goalRow}>
                <View style={styles.goalCol}>
                  <Text style={styles.goalNum}>
                    {goalProgress?.weeklyWorkoutsDone ?? 0} / {goalProgress?.weeklyWorkoutsTarget ?? 4}
                  </Text>
                  <Text style={styles.goalDesc}>Weekly Workouts</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.goalCol}>
                  <Text style={styles.goalNum}>
                    {goalProgress?.currentWeightKg ? `${goalProgress.currentWeightKg} kg` : '--'}
                  </Text>
                  <Text style={styles.goalDesc}>
                    Target: {goalProgress?.targetWeightKg ? `${goalProgress.targetWeightKg} kg` : 'Set in profile'}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Weekly Trends Summary ── */}
            <Text style={styles.sectionTitle}>Weekly Summary</Text>
            <View style={styles.gridRow}>
              <View style={[styles.statBox, { borderLeftColor: COLORS.primary }]}>
                <Text style={styles.statEmoji}>🏋️</Text>
                <Text style={styles.statVal}>{trends?.totalWorkouts ?? 0}</Text>
                <Text style={styles.statLbl}>Total Workouts</Text>
              </View>

              <View style={[styles.statBox, { borderLeftColor: COLORS.orange }]}>
                <Text style={styles.statEmoji}>🔥</Text>
                <Text style={styles.statVal}>{Math.round(trends?.avgCaloriesBurned ?? 0)}</Text>
                <Text style={styles.statLbl}>Avg Burned / day</Text>
              </View>

              <View style={[styles.statBox, { borderLeftColor: COLORS.info }]}>
                <Text style={styles.statEmoji}>💧</Text>
                <Text style={styles.statVal}>{Math.round(trends?.avgWaterMl ?? 0)} ml</Text>
                <Text style={styles.statLbl}>Avg Water / day</Text>
              </View>

              <View style={[styles.statBox, { borderLeftColor: COLORS.purple }]}>
                <Text style={styles.statEmoji}>🌙</Text>
                <Text style={styles.statVal}>{trends?.avgSleep?.toFixed(1) ?? 0} hrs</Text>
                <Text style={styles.statLbl}>Avg Sleep / night</Text>
              </View>
            </View>

            {/* ── Calorie Balance Breakdown ── */}
            <Text style={styles.sectionTitle}>Calorie Balance (Last 7 Days)</Text>
            <View style={styles.card}>
              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceVal}>{balance?.totalBurned ?? 0}</Text>
                  <Text style={styles.balanceLbl}>Total Burned</Text>
                </View>
                <Text style={styles.balanceOperator}>-</Text>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceVal}>{balance?.totalConsumed ?? 0}</Text>
                  <Text style={styles.balanceLbl}>Total Consumed</Text>
                </View>
                <Text style={styles.balanceOperator}>=</Text>
                <View style={styles.balanceItem}>
                  <Text style={[styles.balanceVal, { color: (balance?.netCalories ?? 0) <= 0 ? COLORS.primary : COLORS.danger }]}>
                    {balance?.netCalories ?? 0}
                  </Text>
                  <Text style={styles.balanceLbl}>Net kcal</Text>
                </View>
              </View>
            </View>

            {/* ── Smart AI Insights & Alerts ── */}
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
                  Keep logging your daily meals, workouts, and sleep to generate smart AI insights!
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
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  streakBadge: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#c2410c',
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalCol: {
    flex: 1,
    alignItems: 'center',
  },
  goalNum: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  goalDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  statBox: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
  },
  statEmoji: {
    fontSize: 18,
    marginBottom: 4,
  },
  statVal: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  statLbl: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
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
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
  },
  balanceLbl: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  balanceOperator: {
    fontSize: 18,
    fontWeight: '700',
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
