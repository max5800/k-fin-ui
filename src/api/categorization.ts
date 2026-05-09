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
    mutationFn: async (args: {
      transaction_id: string;
      category_id?: string;
      is_refund?: boolean;
    }) => {
      const body: Record<string, unknown> = {};
      if (args.category_id) body.category_id = args.category_id;
      if (args.is_refund !== undefined) body.is_refund = args.is_refund;
      await apiClient.post(`/categorization/pending/${args.transaction_id}/accept`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.categorization.pending });
      queryClient.invalidateQueries({ queryKey: qk.transactions.all });
      queryClient.invalidateQueries({ queryKey: ['aggregates'] });
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
