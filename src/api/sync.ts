import { useMutation, useQuery } from '@tanstack/react-query';
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

// ---------------------------------------------------------------------------
// Historical backfill — same TAN-in-the-loop pattern, but the worker drives
// the actual fetch as a long-running background task and the UI polls the
// run status for progress.
// ---------------------------------------------------------------------------

export interface BackfillStartResponse {
  status: string;
  session_id: string;
}

export interface BackfillConfirmResponse {
  status: string;
  run_id: string;
  target_start_date: string;
}

export type BackfillRunStatus =
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface BackfillRunResponse {
  run_id: string;
  status: BackfillRunStatus;
  target_start_date: string;
  current_window_start: string | null;
  windows_total: number;
  windows_done: number;
  rows_inserted: number;
  progress_message: string | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export function useStartBackfill() {
  return useMutation({
    mutationFn: async (months: number) => {
      const { data } = await apiClient.post<BackfillStartResponse>(
        '/sync/backfill/start',
        { months },
      );
      return data;
    },
  });
}

export function useConfirmBackfill() {
  return useMutation({
    mutationFn: async (session_id: string) => {
      const { data } = await apiClient.post<BackfillConfirmResponse>(
        '/sync/backfill/confirm',
        null,
        { params: { session_id } },
      );
      return data;
    },
  });
}

export function useBackfillRun(run_id: string | null) {
  return useQuery({
    queryKey: ['backfill-run', run_id],
    queryFn: async (): Promise<BackfillRunResponse> => {
      const { data } = await apiClient.get<BackfillRunResponse>(
        `/sync/backfill/runs/${run_id}`,
      );
      return data;
    },
    enabled: !!run_id,
    // Poll while the modal is open. We stop polling once the run is terminal.
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      return data.status === 'running' ? 2000 : false;
    },
  });
}

// ---------------------------------------------------------------------------
// Sync run history — read-only listing for the Settings page.
// ---------------------------------------------------------------------------

export type SyncRunStatus = 'running' | 'succeeded' | 'failed';
export type SyncRunSource = 'raw_import' | 'normalize';

export interface SyncRun {
  id: string;
  source: SyncRunSource;
  status: SyncRunStatus;
  started_at: string;
  finished_at: string | null;
  rows_processed: number;
  error: string | null;
}

// Exported for direct unit-testing — the cadence is part of the UX contract:
// 2s while a run is in-flight, 30s otherwise. Keep these constants in step
// with src/components/__tests__/SyncRunsHistory.test.tsx and
// src/api/__tests__/sync.test.tsx.
export const SYNC_RUNS_POLL_ACTIVE_MS = 2_000;
export const SYNC_RUNS_POLL_IDLE_MS = 30_000;

export function syncRunsRefetchInterval(
  query: { state: { data: SyncRun[] | undefined } },
): number {
  const data = query.state.data;
  if (data?.some((r) => r.status === 'running')) return SYNC_RUNS_POLL_ACTIVE_MS;
  return SYNC_RUNS_POLL_IDLE_MS;
}

export function useSyncRuns(limit = 20) {
  return useQuery({
    queryKey: ['sync-runs', limit],
    queryFn: async () => {
      const { data } = await apiClient.get<SyncRun[]>('/sync/runs', {
        params: { limit },
      });
      return data;
    },
    // Auto-refresh while the user has the Settings page open. Cheap query
    // and helps spot a sync that finishes after the user leaves the page.
    // While a run is in-flight we poll aggressively (2s) so the "Läuft" badge
    // flips to terminal almost immediately; otherwise idle at 30s.
    refetchInterval: syncRunsRefetchInterval,
  });
}
