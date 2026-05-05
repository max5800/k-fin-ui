import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from '../client';
import {
  SYNC_RUNS_POLL_ACTIVE_MS,
  SYNC_RUNS_POLL_IDLE_MS,
  type SyncRun,
  syncRunsRefetchInterval,
  useSyncRuns,
} from '../sync';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const baseTime = new Date('2026-05-05T20:00:00Z').toISOString();

const succeededRun: SyncRun = {
  id: 'run-ok',
  source: 'raw_import',
  status: 'succeeded',
  started_at: baseTime,
  finished_at: new Date('2026-05-05T20:00:42Z').toISOString(),
  rows_processed: 17,
  error: null,
};

const runningRun: SyncRun = {
  id: 'run-now',
  source: 'raw_import',
  status: 'running',
  started_at: baseTime,
  finished_at: null,
  rows_processed: 0,
  error: null,
};

describe('useSyncRuns', () => {
  it('GETs /sync/runs with the configured limit', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [succeededRun] });

    const { result } = renderHook(() => useSyncRuns(5), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.get).toHaveBeenCalledWith('/sync/runs', {
      params: { limit: 5 },
    });
    expect(result.current.data).toEqual([succeededRun]);
  });
});

describe('syncRunsRefetchInterval', () => {
  it('polls fast (2s) when at least one run is running', () => {
    expect(
      syncRunsRefetchInterval({ state: { data: [runningRun, succeededRun] } }),
    ).toBe(SYNC_RUNS_POLL_ACTIVE_MS);
    expect(SYNC_RUNS_POLL_ACTIVE_MS).toBe(2_000);
  });

  it('idles at 30s when no run is running', () => {
    expect(syncRunsRefetchInterval({ state: { data: [succeededRun] } })).toBe(
      SYNC_RUNS_POLL_IDLE_MS,
    );
    expect(SYNC_RUNS_POLL_IDLE_MS).toBe(30_000);
  });

  it('idles at 30s when data is undefined (initial load)', () => {
    expect(syncRunsRefetchInterval({ state: { data: undefined } })).toBe(
      SYNC_RUNS_POLL_IDLE_MS,
    );
  });

  it('idles at 30s on an empty list', () => {
    expect(syncRunsRefetchInterval({ state: { data: [] } })).toBe(
      SYNC_RUNS_POLL_IDLE_MS,
    );
  });
});
