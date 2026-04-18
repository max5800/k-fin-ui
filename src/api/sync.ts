import { useMutation } from '@tanstack/react-query';
import { apiClient } from './client';

export interface SyncStartResponse {
  status: string;
  session_id: string;
}

export interface SyncConfirmResponse {
  status: string;
  message: string;
  ingest?: { inserted: number; normalized: number } | null;
  agents?: { run_id: string } | null;
}

export function useStartSync() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<SyncStartResponse>('/sync/start');
      return data;
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
      const { data } = await apiClient.post<SyncConfirmResponse>(
        '/sync/confirm',
        null,
        { params: { session_id } },
      );
      return data;
    },
  });
}
