import { request } from './client';

export interface TrainerProfile {
  userId: number;
  first: string;
  last: string;
  specialization?: string | null;
  location?: string | null;
  experienceYears?: number | null;
  contactNo?: string | null;
  availability?: string | null;
  monthlyFee?: number | null;
  verified?: boolean;
}

export type TrainerProfileUpdate = {
  first: string;
  last: string;
  specialization: string;
  location?: string | null;
  experienceYears?: number | null;
  contactNo?: string | null;
  availability?: string | null;
  monthlyFee: number;
};

export interface TrainerClient {
  userId: number;
  fitnessGoal?: string | null;
  since?: string | null;
}

export const getMyClients = async (): Promise<TrainerClient[]> =>
  request<TrainerClient[]>('/api/trainers/me/clients', { method: 'GET' });

export const getMyTrainerProfile = async (): Promise<TrainerProfile> =>
  request<TrainerProfile>('/api/trainers/me', { method: 'GET' });

export const updateMyTrainerProfile = async (profile: TrainerProfileUpdate): Promise<TrainerProfile> =>
  request<TrainerProfile>('/api/trainers/me', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });

export interface TrainerRequest {
  id: number;
  userId: number;
  trainerId: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | string;
  userGoal?: string | null;
  createdAt?: string;
}

export const getPendingTrainerRequests = async (): Promise<TrainerRequest[]> =>
  request<TrainerRequest[]>('/api/trainers/requests/pending', { method: 'GET' });

export const acceptTrainerRequest = async (requestId: number): Promise<TrainerRequest> =>
  request<TrainerRequest>(`/api/trainers/requests/${requestId}/accept`, { method: 'PUT' });

export const rejectTrainerRequest = async (requestId: number): Promise<TrainerRequest> =>
  request<TrainerRequest>(`/api/trainers/requests/${requestId}/reject`, { method: 'PUT' });

export interface TrainerPlan {
  id: number;
  trainerId: number;
  userId: number;
  title: string;
  details: string;
  createdAt?: string;
}

export const assignTrainerPlan = async (data: { userId: number; title: string; details: string }): Promise<TrainerPlan> =>
  request<TrainerPlan>('/api/trainers/plans', {
    method: 'POST',
    body: JSON.stringify({ userId: Number(data.userId), title: data.title.trim(), details: data.details.trim() }),
  });

export const getGivenPlans = async (): Promise<TrainerPlan[]> =>
  request<TrainerPlan[]>('/api/trainers/plans/given', { method: 'GET' });

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export const getRecommendedTrainers = async (): Promise<TrainerProfile[]> => {
  return request<TrainerProfile[]>('/api/trainers/recommended', { method: 'GET' });
};

export const searchTrainers = async (params: {
  q?: string;
  specialization?: string;
  location?: string;
  page?: number;
  size?: number;
} = {}): Promise<PageResponse<TrainerProfile>> => {
  return request<PageResponse<TrainerProfile>>('/api/trainers/search', {
    method: 'GET',
    params: { page: 0, size: 20, ...params },
  });
};

export const getTrainerById = async (trainerId: number): Promise<TrainerProfile> => {
  return request<TrainerProfile>(`/api/trainers/${trainerId}`, { method: 'GET' });
};

export const sendTrainerRequest = async (trainerId: number, userGoal?: string): Promise<TrainerRequest> => {
  return request<TrainerRequest>('/api/trainers/requests', {
    method: 'POST',
    body: JSON.stringify({ trainerId: Number(trainerId), userGoal: userGoal || null }),
  });
};

export const getMyRequests = async (): Promise<TrainerRequest[]> => {
  return request<TrainerRequest[]>('/api/trainers/requests/mine', { method: 'GET' });
};

export const getMyPlans = async (): Promise<TrainerPlan[]> => {
  return request<TrainerPlan[]>('/api/trainers/plans/mine', { method: 'GET' });
};

