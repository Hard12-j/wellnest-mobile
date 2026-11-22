import { request } from './client';

export interface Workout {
  id?: number;
  date: string; // yyyy-MM-dd
  type: string; // WALKING, RUNNING, CYCLING, SWIMMING, YOGA, STRENGTH, HIIT, OTHER
  durationMin: number;
  intensity?: string | null; // LOW, MODERATE, HIGH
  caloriesBurned?: number | null;
  notes?: string | null;
}

export interface Meal {
  id?: number;
  date: string; // yyyy-MM-dd
  mealType: string; // BREAKFAST, LUNCH, DINNER, SNACK
  name: string;
  calories: number;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
}

export interface Sleep {
  id?: number;
  date: string; // yyyy-MM-dd
  hours: number;
  quality?: number | null; // 1-5
}

export interface Hydration {
  id?: number;
  date: string; // yyyy-MM-dd
  amountMl: number;
}

export interface DailyLog {
  date: string;
  workouts: Workout[];
  meals: Meal[];
  hydrationMl: number;
  sleep: Sleep | null;
  sleepHours: number;
  caloriesBurned: number;
  caloriesConsumed: number;
  netCalories: number;
}

export interface NutritionEstimate {
  foodName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source: string;
  breakdown?: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

// ── Daily Summary ──────────────────────────────────────────
export const getDailyLog = async (date?: string): Promise<DailyLog> => {
  return request<DailyLog>('/api/tracker/daily', {
    method: 'GET',
    params: date ? { date } : undefined,
  });
};

// ── Workouts ───────────────────────────────────────────────
export const listWorkouts = async (params: {
  from?: string;
  to?: string;
  page?: number;
  size?: number;
} = {}): Promise<PageResponse<Workout>> => {
  return request<PageResponse<Workout>>('/api/tracker/workouts', {
    method: 'GET',
    params: { page: 0, size: 50, ...params },
  });
};

export const createWorkout = async (data: Workout): Promise<Workout> => {
  return request<Workout>('/api/tracker/workouts', {
    method: 'POST',
    body: JSON.stringify({
      date: data.date,
      type: data.type,
      durationMin: Number(data.durationMin),
      intensity: data.intensity || null,
      caloriesBurned: data.caloriesBurned != null ? Number(data.caloriesBurned) : null,
      notes: data.notes || null,
    }),
  });
};

export const deleteWorkout = async (id: number): Promise<void> => {
  await request(`/api/tracker/workouts/${id}`, { method: 'DELETE' });
};

// ── Meals ──────────────────────────────────────────────────
export const listMeals = async (params: {
  mealType?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
} = {}): Promise<PageResponse<Meal>> => {
  return request<PageResponse<Meal>>('/api/tracker/meals', {
    method: 'GET',
    params: { page: 0, size: 50, ...params },
  });
};

export const createMeal = async (data: Meal): Promise<Meal> => {
  return request<Meal>('/api/tracker/meals', {
    method: 'POST',
    body: JSON.stringify({
      date: data.date,
      mealType: data.mealType,
      name: data.name?.trim(),
      calories: Number(data.calories),
      proteinG: data.proteinG != null ? Number(data.proteinG) : null,
      carbsG: data.carbsG != null ? Number(data.carbsG) : null,
      fatG: data.fatG != null ? Number(data.fatG) : null,
    }),
  });
};

export const deleteMeal = async (id: number): Promise<void> => {
  await request(`/api/tracker/meals/${id}`, { method: 'DELETE' });
};

export const estimateNutrition = async (query: string): Promise<NutritionEstimate> => {
  return request<NutritionEstimate>('/api/tracker/meals/estimate', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
};

// ── Hydration ──────────────────────────────────────────────
export const listHydration = async (params: {
  from?: string;
  to?: string;
  page?: number;
  size?: number;
} = {}): Promise<PageResponse<Hydration>> => {
  return request<PageResponse<Hydration>>('/api/tracker/hydration', {
    method: 'GET',
    params: { page: 0, size: 50, ...params },
  });
};

export const createHydration = async (data: {
  date: string;
  amountMl: number;
}): Promise<Hydration> => {
  return request<Hydration>('/api/tracker/hydration', {
    method: 'POST',
    body: JSON.stringify({
      date: data.date,
      amountMl: Number(data.amountMl),
    }),
  });
};

export const deleteHydration = async (id: number): Promise<void> => {
  await request(`/api/tracker/hydration/${id}`, { method: 'DELETE' });
};

// ── Sleep ──────────────────────────────────────────────────
export const listSleep = async (params: {
  from?: string;
  to?: string;
  page?: number;
  size?: number;
} = {}): Promise<PageResponse<Sleep>> => {
  return request<PageResponse<Sleep>>('/api/tracker/sleep', {
    method: 'GET',
    params: { page: 0, size: 50, ...params },
  });
};

export const createSleep = async (data: {
  date: string;
  hours: number;
  quality?: number | null;
}): Promise<Sleep> => {
  return request<Sleep>('/api/tracker/sleep', {
    method: 'POST',
    body: JSON.stringify({
      date: data.date,
      hours: Number(data.hours),
      quality: data.quality ? Number(data.quality) : null,
    }),
  });
};

export const deleteSleep = async (id: number): Promise<void> => {
  await request(`/api/tracker/sleep/${id}`, { method: 'DELETE' });
};

