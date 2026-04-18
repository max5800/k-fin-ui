import { useQuery } from '@tanstack/react-query';
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
