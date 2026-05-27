import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import { qk } from '../lib/queryKeys';

export const FRONTEND_VERSION = __K_FIN_UI_VERSION__;

export interface AppVersion {
  backend_version: string;
}

export function useAppVersion() {
  return useQuery({
    queryKey: qk.meta.version,
    queryFn: async () => {
      const { data } = await apiClient.get<AppVersion>('/meta/version');
      return data;
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
  });
}
