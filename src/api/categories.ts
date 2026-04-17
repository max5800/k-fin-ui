import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { qk } from '../lib/queryKeys';
import type { Category, Budget, Tag } from './types';

// Categories
export function useCategories() {
  return useQuery({
    queryKey: qk.categories.all,
    queryFn: async () => {
      const { data } = await apiClient.get<Category[]>('/categories');
      return data;
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (category: Partial<Category>) => {
      const { data } = await apiClient.post<Category>('/categories', category);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.categories.all });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.categories.all });
    },
  });
}

// Budgets
export function useBudgets() {
  return useQuery({
    queryKey: qk.categories.budgets,
    queryFn: async () => {
      const { data } = await apiClient.get<Budget[]>('/categories/budgets');
      return data;
    },
  });
}

export function useUpsertBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ category_id, ...data }: { category_id: string; monthly_limit: number; currency: string }) => {
      const { data: updated } = await apiClient.put<Budget>(`/categories/budgets/${category_id}`, data);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.categories.budgets });
    },
  });
}

// Tags
export function useTags() {
  return useQuery({
    queryKey: qk.tags.all,
    queryFn: async () => {
      const { data } = await apiClient.get<Tag[]>('/tags');
      return data;
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tag: Partial<Tag>) => {
      const { data } = await apiClient.post<Tag>('/tags', tag);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.tags.all });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tags/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.tags.all });
    },
  });
}
