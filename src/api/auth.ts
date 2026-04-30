import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import { UserPublic } from './types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserPublic;
}

export function useLogin() {
  return useMutation({
    mutationFn: async (creds: LoginCredentials) => {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', creds);
      return data;
    },
  });
}

export function useMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get<UserPublic>('/auth/me');
      return data;
    },
    // Do not retry on 401 — interceptor will redirect
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (req: ChangePasswordRequest) => {
      await apiClient.post('/auth/change-password', req);
    },
  });
}
