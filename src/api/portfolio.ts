import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { qk } from '../lib/queryKeys';
import type {
  AllocationBucket,
  Depot,
  Instrument,
  InstrumentPricePoint,
  PerformancePoint,
  PerformanceRange,
  PortfolioSummary,
  Position,
  PriceBackfillResult,
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

// ── Instrument metadata + price history (M11) ──────────────────────────────

// PATCH /portfolio/instruments/{isin} — currently only the ticker_symbol
// field is mutable. Pass ``null`` to clear a previously set ticker.
export function usePatchInstrument(isin: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ticker_symbol: string | null) => {
      const { data } = await apiClient.patch<Instrument>(
        `/portfolio/instruments/${encodeURIComponent(isin)}`,
        { ticker_symbol },
      );
      return data;
    },
    onSuccess: () => {
      // Positions carry the embedded Instrument, so a ticker change must
      // bust every depot's positions cache. The instrument-scoped key is
      // the public root for any future per-ISIN derived queries.
      queryClient.invalidateQueries({ queryKey: ['portfolio', 'positions'] });
      queryClient.invalidateQueries({ queryKey: qk.portfolio.instrument(isin) });
    },
  });
}

// POST /portfolio/instruments/{isin}/backfill-prices — dispatches a
// yfinance fetch on the worker. The router enforces a 5-year window cap
// (returns HTTP 422), and the worker raises HTTP 400 with a "yfinance
// returns X for ticker Y, instrument is in Z" detail on currency mismatch.
export function useBackfillPrices(isin: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (range: { from_date: string; to_date: string }) => {
      const { data } = await apiClient.post<PriceBackfillResult>(
        `/portfolio/instruments/${encodeURIComponent(isin)}/backfill-prices`,
        range,
      );
      return data;
    },
    onSuccess: () => {
      // Refresh every prices query for this ISIN regardless of window —
      // the new rows may fall outside the user's currently-viewed range.
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey;
          return (
            Array.isArray(k) &&
            k[0] === 'portfolio' &&
            k[1] === 'prices' &&
            k[2] === isin
          );
        },
      });
    },
  });
}

// GET /portfolio/instruments/{isin}/prices — cached daily closes. ``from``
// and ``to`` are optional ISO dates (yyyy-MM-dd); the backend treats the
// range as half-open if either bound is omitted.
export function useInstrumentPrices(
  isin: string | null,
  from: string | null,
  to: string | null,
) {
  return useQuery({
    queryKey: qk.portfolio.prices(isin ?? '', from, to),
    enabled: Boolean(isin),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const { data } = await apiClient.get<InstrumentPricePoint[]>(
        `/portfolio/instruments/${encodeURIComponent(isin ?? '')}/prices`,
        { params },
      );
      return data;
    },
  });
}
