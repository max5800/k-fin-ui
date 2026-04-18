import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { qk } from '../lib/queryKeys';
import type { PendingResponse } from './types';

export function usePendingSuggestions() {
  return useQuery({
    queryKey: qk.categorization.pending,
    queryFn: async () => {
      const { data } = await apiClient.get<PendingResponse>('/categorization/pending');
      return data;
    },
  });
}

export function useAcceptSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { transaction_id: string; category_id?: string }) => {
      const body = args.category_id ? { category_id: args.category_id } : {};
      await apiClient.post(`/categorization/pending/${args.transaction_id}/accept`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.categorization.pending });
      queryClient.invalidateQueries({ queryKey: qk.transactions.all });
    },
  });
}

export function useRejectSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transaction_id: string) => {
      await apiClient.post(`/categorization/pending/${transaction_id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.categorization.pending });
    },
  });
}
