
import { request } from './client';

export interface DayPoint {
  date: string; // yyyy-MM-dd
  caloriesConsumed: number;
  caloriesBurned: number;
  netCalories: number;
  workoutCount: number;
  workoutMinutes: number;
  waterMl: number;
  sleepHours: number;
  logged: boolean;
}

export interface WeeklyTrendsResponse {
  from: string;
  to: string;
  days: DayPoint[];
}

export interface BalanceDay {
  date: string;
  consumed: number;
  burned: number;
  net: number;
}

export interface CaloriesBalanceResponse {
  from: string;
  to: string;
  days: BalanceDay[];
  totalConsumed: number;
  totalBurned: number;
  totalNet: number;
}

export interface GoalProgressResponse {
  status: string; // NO_PROFILE | NO_TARGET | IN_PROGRESS | ACHIEVED
  fitnessGoal?: string;
  startWeightKg?: number;
  currentWeightKg?: number;
  targetWeightKg?: number;
  changedKg?: number;
  remainingKg?: number;
  progressPercent?: number;
  currentStreakDays: number;
  daysLoggedLast7: number;
}

export interface InsightItem {
  id?: string;
  title: string;
  description: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ALERT';
}

export interface InsightsResponse {
  insights: InsightItem[];
}

export interface WorkoutsGoalCard {
  badge: string;
  subtitle: string;
  completedDays: number;
  targetDays: number;
  percentage: number;
  moreToGo: number;
  daysLeft: number;
  tip: string;
}

export interface WaterGoalCard {
  badge: string;
  subtitle: string;
  currentLitres: number;
  targetLitres: number;
  percentage: number;
  remainingLitres: number;
  streakDays: number;
  tip: string;
}

export interface SleepGoalCard {
  badge: string;
  subtitle: string;
  avgHours: number;
  targetHours: number;
  percentage: number;
  comparisonText: string;
  bestHours: number;
  tip: string;
}

export interface GoalCardProgressResponse {
  workouts?: WorkoutsGoalCard;
  water?: WaterGoalCard;
  sleep?: SleepGoalCard;
}

export const getWeeklyTrends = async (from?: string, to?: string): Promise<WeeklyTrendsResponse> => {
  return request<WeeklyTrendsResponse>('/api/analytics/weekly-trends', {
    method: 'GET',
    params: { from, to },
  });
};

export const getCaloriesBalance = async (from?: string, to?: string): Promise<CaloriesBalanceResponse> => {
  return request<CaloriesBalanceResponse>('/api/analytics/calories-balance', {
    method: 'GET',
    params: { from, to },
  });
};

export const getGoalProgress = async (): Promise<GoalProgressResponse> => {
  return request<GoalProgressResponse>('/api/analytics/goal-progress', {
    method: 'GET',
  });
};

export const getInsights = async (): Promise<InsightsResponse> => {
  return request<InsightsResponse>('/api/analytics/insights', {
    method: 'GET',
  });
};

export const getGoalCards = async (): Promise<GoalCardProgressResponse> => {
  return request<GoalCardProgressResponse>('/api/analytics/goal-cards', {
    method: 'GET',
  });
};
