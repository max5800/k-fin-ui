import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { qk } from '../lib/queryKeys';
import type { AppSettings } from './types';

export function useSettings() {
  return useQuery({
    queryKey: qk.settings.all,
    queryFn: async () => {
      const { data } = await apiClient.get<AppSettings>('/settings');
      return data;
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<AppSettings>) => {
      const { data } = await apiClient.put<AppSettings>('/settings', patch);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.settings.all });
    },
  });
}

export interface WebhookTestResult {
  success: boolean;
  status_code: number | null;
  error: string | null;
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<WebhookTestResult>(
        '/settings/webhook/test',
      );
      return data;
    },
  });
}
