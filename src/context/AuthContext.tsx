import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../api/authApi';
import { getStoredToken, getStoredUser, clearStoredAuth, setStoredToken, setStoredUser } from '../api/client';

interface AuthContextType {
  user: authApi.User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (params: { username: string; password: string }) => Promise<authApi.AuthResponse>;
  register: (params: {
    first: string;
    last: string;
    username: string;
    password: string;
    confirmPassword: string;
    role?: string;
  }) => Promise<authApi.MessageResponse>;
  verifyEmail: (params: { username: string; otp: string }) => Promise<authApi.MessageResponse>;
  resendOtp: (params: { username: string }) => Promise<authApi.MessageResponse>;
  forgotPassword: (params: { username: string }) => Promise<authApi.MessageResponse>;
  resetPassword: (params: {
    username: string;
    otp: string;
    newPassword: string;
  }) => Promise<authApi.MessageResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<authApi.User | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<authApi.User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session from SecureStore on app launch
  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const storedToken = await getStoredToken();
        const storedUser = await getStoredUser();

        if (storedToken && storedUser) {
          if (mounted) {
            setToken(storedToken);
            setUser(storedUser);
            setIsAuthenticated(true);
          }

          // Background revalidation
          try {
            const freshUser = await authApi.getCurrentUser();
            if (mounted && freshUser) {
              setUser(freshUser);
            }
          } catch {
            // Keep stored session if offline or cold start
          }
        }
      } catch (err) {
        console.warn('Failed to restore session:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (params: { username: string; password: string }) => {
    const data = await authApi.login(params);
    if (data.accessToken) {
      setToken(data.accessToken);
    }
    if (data.user) {
      setUser(data.user);
      setIsAuthenticated(true);
    }
    return data;
  }, []);

  const register = useCallback(
    async (params: {
      first: string;
      last: string;
      username: string;
      password: string;
      confirmPassword: string;
      role?: string;
    }) => {
      return authApi.register(params);
    },
    []
  );

  const verifyEmail = useCallback(async (params: { username: string; otp: string }) => {
    return authApi.verifyEmail(params);
  }, []);

  const resendOtp = useCallback(async (params: { username: string }) => {
    return authApi.resendVerification(params);
  }, []);

  const forgotPassword = useCallback(async (params: { username: string }) => {
    return authApi.forgotPassword(params);
  }, []);

  const resetPassword = useCallback(
    async (params: { username: string; otp: string; newPassword: string }) => {
      return authApi.resetPassword(params);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      await clearStoredAuth();
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const fresh = await authApi.getCurrentUser();
      setUser(fresh);
      return fresh;
    } catch {
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        register,
        verifyEmail,
        resendOtp,
        forgotPassword,
        resetPassword,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
