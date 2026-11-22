import { request, setStoredToken, setStoredUser, clearStoredAuth } from './client';

export interface User {
  id: number;
  first: string;
  last: string;
  username: string;
  role: 'USER' | 'TRAINER' | string;
  verifiedUser: boolean;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

export interface MessageResponse {
  message: string;
}

export const register = async (params: {
  first: string;
  last: string;
  username: string;
  password: string;
  confirmPassword: string;
  role?: string;
}): Promise<MessageResponse> => {
  return request<MessageResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(params),
  });
};

export const login = async (params: {
  username: string;
  password: string;
}): Promise<AuthResponse> => {
  const data = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  if (data?.accessToken) {
    await setStoredToken(data.accessToken);
  }
  if (data?.user) {
    await setStoredUser(data.user);
  }
  return data;
};

export const verifyEmail = async (params: {
  username: string;
  otp: string;
}): Promise<MessageResponse> => {
  return request<MessageResponse>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(params),
  });
};

export const resendVerification = async (params: {
  username: string;
}): Promise<MessageResponse> => {
  return request<MessageResponse>('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify(params),
  });
};

export const forgotPassword = async (params: {
  username: string;
}): Promise<MessageResponse> => {
  return request<MessageResponse>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(params),
  });
};

export const resetPassword = async (params: {
  username: string;
  otp: string;
  newPassword: string;
}): Promise<MessageResponse> => {
  return request<MessageResponse>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(params),
  });
};

export const getCurrentUser = async (): Promise<User> => {
  const user = await request<User>('/auth/me', { method: 'GET' });
  if (user) {
    await setStoredUser(user);
  }
  return user;
};

export const logout = async (): Promise<void> => {
  try {
    await request('/auth/logout', { method: 'POST' });
  } catch {
    // Ignore network errors on logout
  } finally {
    await clearStoredAuth();
  }
};

