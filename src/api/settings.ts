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
