import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { qk, type RunFilters } from '../lib/queryKeys';
import type { Run, PaginatedResponse } from './types';

export function useRuns(filters: RunFilters) {
  return useQuery({
    queryKey: qk.runs.list(filters),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Run>>('/runs', {
        params: filters,
      });
      return data;
    },
    // Polling logic for active runs
    refetchInterval: (query) => {
      const data = query.state.data as PaginatedResponse<Run> | undefined;
      const hasActiveRuns = data?.items.some(
        run => run.status === 'pending' || run.status === 'running'
      );
      return hasActiveRuns ? 5000 : false;
    },
  });
}

export function useRun(id: string) {
  return useQuery({
    queryKey: qk.runs.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<Run>(`/runs/${id}`);
      return data;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const run = query.state.data as Run | undefined;
      return run?.status === 'pending' || run?.status === 'running' ? 5000 : false;
    }
  });
}

// Args for the trigger mutations. `period_days` overrides the agent's
// built-in time window; backend (k-fin v1.34) clamps to [1, 3650] and
// forwards it to weekly/monthly/anomaly only — categorization and
// synthesis ignore it. Omit to keep the agent's default.
export type TriggerSingleArgs = {
  agent_name: string;
  period_days?: number;
};

export type TriggerFullArgs = {
  period_days?: number;
};

export function useTriggerRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ agent_name, period_days }: TriggerSingleArgs) => {
      const { data } = await apiClient.post<Run>(
        `/runs/${agent_name}`,
        { trigger: 'manual' },
        period_days !== undefined ? { params: { period_days } } : undefined,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.runs.all });
    },
  });
}

export function useTriggerFullPipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: TriggerFullArgs = {}) => {
      const { period_days } = args;
      const { data } = await apiClient.post<Run>(
        '/runs/full',
        { trigger: 'manual' },
        period_days !== undefined ? { params: { period_days } } : undefined,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.runs.all });
    },
  });
}

export function useCancelRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (run_id: string) => {
      await apiClient.delete(`/runs/${run_id}`);
      return run_id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.runs.all });
    },
  });
}

export function useRerunRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (run_id: string) => {
      const { data } = await apiClient.post<Run>(`/runs/${run_id}/rerun`, {});
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.runs.all });
    },
  });
}
