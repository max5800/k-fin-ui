import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

// `/dev/status` is always reachable; the destructive endpoints 404 on
// production builds because the backend doesn't mount them. The UI uses
// this to decide whether to render the "Dev Tools" sidebar entry at all.
export interface DevStatus {
  enabled: boolean;
  app_env: string;
}

export interface WipeResult {
  wiped_tables: string[];
  transaction_count_before: number;
  transaction_count_after: number;
}

export interface SeedResult {
  inserted_transactions: number;
  period_start: string;
  period_end: string;
  refund_count: number;
  internal_transfer_count: number;
  outlier_count: number;
}

export function useDevStatus() {
  return useQuery({
    queryKey: ['dev', 'status'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<DevStatus>('/dev/status');
      return data;
    },
    // Cache aggressively — value flips only on a Helm change → pod roll.
    staleTime: 60 * 60 * 1000,
  });
}

function invalidateAllData(queryClient: ReturnType<typeof useQueryClient>) {
  // After a wipe or seed, every query that touches transaction data is
  // stale. Cheaper to nuke the cache than to enumerate every key.
  queryClient.invalidateQueries({ queryKey: ['transactions'] });
  queryClient.invalidateQueries({ queryKey: ['aggregates'] });
  queryClient.invalidateQueries({ queryKey: ['categories'] });
  queryClient.invalidateQueries({ queryKey: ['runs'] });
  queryClient.invalidateQueries({ queryKey: ['reports'] });
  queryClient.invalidateQueries({ queryKey: ['categorization'] });
}

export function useDevWipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<WipeResult>('/dev/wipe');
      return data;
    },
    onSuccess: () => invalidateAllData(queryClient),
  });
}

export function useDevSeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<SeedResult>('/dev/seed');
      return data;
    },
    onSuccess: () => invalidateAllData(queryClient),
  });
}
