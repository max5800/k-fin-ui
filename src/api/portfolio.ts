import { useQueries, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import { qk } from '../lib/queryKeys';
import type {
  AllocationBucket,
  Depot,
  PerformancePoint,
  PerformanceRange,
  PortfolioSummary,
  Position,
} from './types';

export function usePortfolioSummary() {
  return useQuery({
    queryKey: qk.portfolio.summary,
    queryFn: async () => {
      const { data } = await apiClient.get<PortfolioSummary>('/portfolio/summary');
      return data;
    },
  });
}

export function usePortfolioAllocation() {
  return useQuery({
    queryKey: qk.portfolio.allocation,
    queryFn: async () => {
      const { data } = await apiClient.get<AllocationBucket[]>('/portfolio/allocation');
      return data;
    },
  });
}

export function usePortfolioPerformance(range: PerformanceRange) {
  return useQuery({
    queryKey: qk.portfolio.performance(range),
    queryFn: async () => {
      const { data } = await apiClient.get<PerformancePoint[]>('/portfolio/performance', {
        params: { range },
      });
      return data;
    },
  });
}

export function useDepots() {
  return useQuery({
    queryKey: qk.portfolio.depots,
    queryFn: async () => {
      const { data } = await apiClient.get<Depot[]>('/depots');
      return data;
    },
  });
}

export function usePositions(depotId: string | null | undefined) {
  return useQuery({
    queryKey: qk.portfolio.positions(depotId ?? null),
    enabled: Boolean(depotId),
    queryFn: async () => {
      const { data } = await apiClient.get<Position[]>(`/depots/${depotId}/positions`);
      return data;
    },
  });
}

// Loads positions for every passed depot in parallel, keyed by depot_id.
// Used by the Portfolio page to drive the per-depot tabs without forcing
// a refetch when the user switches between them.
export function useAllPositions(depots: Depot[] | undefined) {
  const list = depots ?? [];
  const results = useQueries({
    queries: list.map((d) => ({
      queryKey: qk.portfolio.positions(d.depot_id),
      queryFn: async () => {
        const { data } = await apiClient.get<Position[]>(`/depots/${d.depot_id}/positions`);
        return data;
      },
    })),
  });
  const byDepotId: Record<string, Position[]> = {};
  list.forEach((d, i) => {
    byDepotId[d.depot_id] = results[i]?.data ?? [];
  });
  return {
    byDepotId,
    isPending: list.length > 0 && results.some((q) => q.isPending),
  };
}
