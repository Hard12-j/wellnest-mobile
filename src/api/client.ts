import * as SecureStore from 'expo-secure-store';

export const GATEWAY_URL =
  process.env.EXPO_PUBLIC_GATEWAY_URL || 'https://gateway-service-o8ua.onrender.com';

const TOKEN_KEY = 'wellnest_access_token';
const USER_KEY = 'wellnest_user';
const TRAINER_MONTHLY_FEE_DRAFT_KEY = 'wellnest_trainer_monthly_fee_draft';
const LEGACY_TRAINER_SESSION_FEE_DRAFT_KEY = 'wellnest_trainer_session_fee_draft';

let inMemoryToken: string | null = null;
let inMemoryUserId: number | null = null;
let inMemoryUserRole: string | null = null;

export const setStoredToken = async (token: string | null) => {
  inMemoryToken = token;
  if (token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
};

export const getStoredToken = async (): Promise<string | null> => {
  if (inMemoryToken) return inMemoryToken;
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    inMemoryToken = token;
    return token;
  } catch {
    return null;
  }
};

export const setStoredUser = async (user: any) => {
  if (user) {
    inMemoryUserId = user.id ? Number(user.id) : null;
    inMemoryUserRole = user.role || null;
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  } else {
    inMemoryUserId = null;
    inMemoryUserRole = null;
    await SecureStore.deleteItemAsync(USER_KEY);
  }
};

export const getStoredUser = async (): Promise<any | null> => {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    inMemoryUserId = user?.id ? Number(user.id) : null;
    inMemoryUserRole = user?.role || null;
    return user;
  } catch {
    return null;
  }
};

export const setTrainerMonthlyFeeDraft = async (fee: string) => {
  await SecureStore.setItemAsync(TRAINER_MONTHLY_FEE_DRAFT_KEY, fee);
  await SecureStore.deleteItemAsync(LEGACY_TRAINER_SESSION_FEE_DRAFT_KEY);
};

export const getTrainerMonthlyFeeDraft = async (): Promise<string | null> => {
  try {
    return (await SecureStore.getItemAsync(TRAINER_MONTHLY_FEE_DRAFT_KEY))
      || (await SecureStore.getItemAsync(LEGACY_TRAINER_SESSION_FEE_DRAFT_KEY));
  } catch {
    return null;
  }
};

export const clearTrainerMonthlyFeeDraft = async () => {
  await Promise.all([
    SecureStore.deleteItemAsync(TRAINER_MONTHLY_FEE_DRAFT_KEY),
    SecureStore.deleteItemAsync(LEGACY_TRAINER_SESSION_FEE_DRAFT_KEY),
  ]);
};

export const clearStoredAuth = async () => {
  inMemoryToken = null;
  inMemoryUserId = null;
  inMemoryUserRole = null;
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
};

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number = 0, data: any = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const extractErrorMessage = (error: any): string => {
  if (!error) return 'An unexpected error occurred.';
  if (typeof error === 'string') return error;

  // Check 429 specifically FIRST (before raw error.message)
  if (error.status === 429 || (error.message && error.message.includes('429'))) {
    return 'Render free-tier rate limit active. Cloudflare is cooling down — please wait 1 minute before retrying.';
  }

  if (error.data?.message) {
    return error.data.message;
  }

  // Handle known HTTP status codes before generic error.message
  switch (error.status) {
    case 400:
      return error.data?.message || error.data?.error || 'Invalid request. Please check your input.';
    case 401:
      return 'Session expired. Please log in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'Resource not found.';
    case 409:
      return error.data?.message || 'A conflict occurred. The entry may already exist.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Backend service is starting up on Render. Please retry in a few seconds.';
  }

  if (error.message) {
    if (error.message.includes('Network request failed') || error.message.includes('fetch')) {
      return 'Server is starting up (Render cold-start). Please wait a moment and try again.';
    }
    return error.message;
  }

  return 'An unexpected error occurred.';
};

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  params?: Record<string, any>;
}

// Simple request queue spacer: ensures outgoing requests are spaced by at least 150ms
// to prevent tripping Cloudflare's burst rate limit
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 150;

async function throttleRequest(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export async function request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 45000, retries = 1, params, ...customConfig } = options;

  let url = `${GATEWAY_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }

  const token = await getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(customConfig.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (inMemoryUserId) {
    headers['X-User-Id'] = String(inMemoryUserId);
  }
  if (inMemoryUserRole) {
    headers['X-UserRole'] = inMemoryUserRole;
    headers['X-User-Role'] = inMemoryUserRole;
  }

  const config: RequestInit = {
    ...customConfig,
    headers,
  };

  let attempt = 0;
  while (attempt <= retries) {
    attempt++;
    await throttleRequest();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });
      clearTimeout(timer);

      let responseData: any = null;
      const text = await response.text();
      if (text) {
        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = text;
        }
      }

      if (!response.ok) {
        // If 429, DO NOT RETRY! Retrying on 429 extends the Cloudflare ban.
        if (response.status === 429) {
          throw new ApiError(
            'Render rate limit reached. Please wait ~1 minute before retrying.',
            429,
            responseData
          );
        }

        // If 502, 503, 504 on Render cold-start, retry ONCE with backoff
        if ((response.status >= 502 && response.status <= 504) && attempt <= retries) {
          await new Promise((r) => setTimeout(r, 3000 * attempt));
          continue;
        }

        throw new ApiError(
          responseData?.message || `Request failed with status ${response.status}`,
          response.status,
          responseData
        );
      }

      return responseData as T;
    } catch (err: any) {
      clearTimeout(timer);

      // If it's already an ApiError (like 429), don't retry, re-throw immediately
      if (err instanceof ApiError) {
        throw err;
      }

      const isNetworkOrTimeout =
        err?.name === 'AbortError' ||
        err?.message?.includes('Network request failed') ||
        err?.message?.includes('Failed to fetch');

      if (isNetworkOrTimeout && attempt <= retries) {
        await new Promise((r) => setTimeout(r, 3000 * attempt));
        continue;
      }
      throw err;
    }
  }

  throw new ApiError('Request timed out after retries. The server might be waking up.', 504);
}
