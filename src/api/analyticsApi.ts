import { request } from './client';

export interface WeeklyTrendDay {
  date: string;
  caloriesBurned: number;
  caloriesConsumed: number;
  waterMl: number;
  sleepHours: number;
}

export interface WeeklyTrendsResponse {
  from: string;
  to: string;
  days: WeeklyTrendDay[];
  totalWorkouts: number;
  avgCaloriesBurned: number;
  avgSleep: number;
  avgWaterMl: number;
}

export interface CaloriesBalanceResponse {
  from: string;
  to: string;
  totalBurned: number;
  totalConsumed: number;
  netCalories: number;
  targetDailyDeficit?: number;
}

export interface GoalProgressResponse {
  streakDays: number;
  currentWeightKg?: number;
  targetWeightKg?: number;
  weightDeltaKg?: number;
  weeklyWorkoutsTarget?: number;
  weeklyWorkoutsDone?: number;
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

export interface GoalCardItem {
  type: string; // WORKOUT, WATER, SLEEP
  target: number;
  achieved: number;
  unit: string;
  assignedBy?: string;
}

export interface GoalCardProgressResponse {
  cards: GoalCardItem[];
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

