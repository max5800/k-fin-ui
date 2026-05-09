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

export interface BudgetSpendingItem {
  category_id: string;
  category_name: string;
  monthly_limit: number;
  currency: string;
  spent_gross: number;
  refunded: number;
  spent_net: number;
  remaining: number;
  transaction_count: number;
}

export interface BudgetSpendingOut {
  year: number;
  month: number;
  items: BudgetSpendingItem[];
}

export function useBudgetSpending(year: number, month: number) {
  return useQuery({
    queryKey: ['aggregates', 'budget-spending', year, month] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<BudgetSpendingOut>(
        '/aggregates/budget-spending',
        { params: { year, month } },
      );
      return data;
    },
  });
}

export interface RefundAuditCandidate {
  id: string;
  booking_date: string;
  amount: number;
  sender: string | null;
  recipient: string | null;
  description: string | null;
  suggested_category_id: string | null;
  suggested_reason: string | null;
}

export interface RefundAuditOut {
  candidates: RefundAuditCandidate[];
  total: number;
}

export function useRefundAudit() {
  return useQuery({
    queryKey: ['aggregates', 'refund-audit'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<RefundAuditOut>('/aggregates/refund-audit');
      return data;
    },
  });
}
