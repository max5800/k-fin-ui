import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { qk, type TxFilters } from '../lib/queryKeys';
import type { Transaction, PaginatedResponse } from './types';

export function useTransactions(filters: TxFilters) {
  return useQuery({
    queryKey: qk.transactions.list(filters),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Transaction>>('/transactions', {
        params: filters,
      });
      return data;
    },
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: qk.transactions.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<Transaction>(`/transactions/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; category_id?: string | null; tags?: string[] }) => {
      const { data: updated } = await apiClient.patch<Transaction>(`/transactions/${id}`, data);
      return updated;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: qk.transactions.all });
      queryClient.invalidateQueries({ queryKey: qk.transactions.detail(data.id) });
    },
  });
}
