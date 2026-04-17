import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import { qk } from '../lib/queryKeys';
import type { MonthlySummary, CashflowOverTime } from './types';

export function useMonthlySummary(year: number, month: number) {
  return useQuery({
    queryKey: qk.aggregates.monthly(year, month),
    queryFn: async () => {
      const { data } = await apiClient.get<MonthlySummary>(
        '/aggregates/monthly-summary',
        { params: { year, month } },
      );
      return data;
    },
  });
}

export function useCashflow(months = 12) {
  return useQuery({
    queryKey: qk.aggregates.cashflow(months),
    queryFn: async () => {
      const { data } = await apiClient.get<CashflowOverTime>(
        '/aggregates/cashflow-over-time',
        { params: { months } },
      );
      return data;
    },
  });
}
