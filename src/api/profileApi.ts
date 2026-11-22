import { request } from './client';

export interface Profile {
  userId?: number;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  targetWeightKg?: number | null;
  fitnessGoal?: string | null;
  hasAvatar?: boolean;
  updatedAt?: string;
}

export interface BmiResponse {
  bmi: number;
  category: string;
  guidance: string;
  kgToTarget?: number | null;
}

export const getProfile = async (): Promise<Profile> => {
  return request<Profile>('/api/profile/me', { method: 'GET' });
};

export const updateProfile = async (data: {
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  targetWeightKg?: number | null;
  fitnessGoal?: string | null;
}): Promise<Profile> => {
  return request<Profile>('/api/profile/me', {
    method: 'PUT',
    body: JSON.stringify({
      age: data.age ? Number(data.age) : null,
      heightCm: data.heightCm ? Number(data.heightCm) : null,
      weightKg: data.weightKg ? Number(data.weightKg) : null,
      targetWeightKg: data.targetWeightKg ? Number(data.targetWeightKg) : null,
      fitnessGoal: data.fitnessGoal || null,
    }),
  });
};

export const getBmi = async (): Promise<BmiResponse> => {
  return request<BmiResponse>('/api/profile/bmi', { method: 'GET' });
};
