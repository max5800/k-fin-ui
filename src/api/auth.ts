import { useMutation } from '@tanstack/react-query';
import { apiClient } from './client';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export function useLogin() {
  return useMutation({
    mutationFn: async (creds: LoginCredentials) => {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', creds);
      return data;
    },
  });
}
