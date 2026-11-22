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
  verified?: boolean;
}

export interface TrainerRequest {
  id: number;
  userId: number;
  trainerId: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | string;
  userGoal?: string | null;
  createdAt?: string;
}

export interface TrainerPlan {
  id: number;
  trainerId: number;
  userId: number;
  title: string;
  details: string;
  createdAt?: string;
}

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

