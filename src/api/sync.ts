import { useMutation } from '@tanstack/react-query';
import { apiClient } from './client';

export function useStartSync() {
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/sync/start');
    },
  });
}

export function useNormalizeSync() {
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/sync/normalize');
    },
  });
}

export function useConfirmSync() {
  return useMutation({
    mutationFn: async (session_id: string) => {
      await apiClient.post('/sync/confirm', { session_id });
    },
  });
}
