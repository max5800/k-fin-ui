import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { apiClient } from './client';
import { qk } from '../lib/queryKeys';
import type {
  Budget,
  Category,
  CategoryRule,
  CategoryRuleCreate,
  CategoryRuleUpdate,
  Tag,
} from './types';

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

// ── Categorization rules ─────────────────────────────────────────────
//
// Regex-driven auto-categorization rules. The CRUD endpoints
// (/categories/rules) are scheduled but not yet shipped on the backend
// — see the README of this PR. Until they land, useRules degrades to an
// empty list on 404 so the UI stays usable, and the mutations surface
// the backend error verbatim through the standard React-Query path
// (RulesSection renders it as a toast and reverts the optimistic state).
function isMissingRulesEndpoint(err: unknown): boolean {
  return isAxiosError(err) && err.response?.status === 404;
}

export function useRules() {
  return useQuery({
    queryKey: qk.rules.all,
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<CategoryRule[]>('/categories/rules');
        return data;
      } catch (err) {
        if (isMissingRulesEndpoint(err)) return [] as CategoryRule[];
        throw err;
      }
    },
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rule: CategoryRuleCreate) => {
      const { data } = await apiClient.post<CategoryRule>('/categories/rules', rule);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.rules.all });
    },
  });
}

export function useUpdateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: number } & CategoryRuleUpdate) => {
      const { data } = await apiClient.patch<CategoryRule>(
        `/categories/rules/${id}`,
        patch,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.rules.all });
    },
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/categories/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.rules.all });
    },
  });
}

// Result of POST /categories/rules/apply-all. Mirrors
// `RulesApplyResult` in src/api/schemas.py — the count fields are
// nullable on a 202 (async) response and populated on a 200 (sync)
// response.
export type RulesApplyResult = {
  status: string;
  processed: number | null;
  matched: number | null;
  unchanged: number | null;
};

// POST /categories/rules/apply-all — re-runs the existing rule set
// over every uncategorized transaction. Returns 200 + counts when
// <= 1000 rows are scanned, otherwise 202 with a background task and
// `status='accepted'`. The mutation invalidates both the rules cache
// and the transactions cache: the matched rows now carry a category,
// so any open transactions list must refetch.
export function useApplyAllRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ result: RulesApplyResult; accepted: boolean }> => {
      const response = await apiClient.post<RulesApplyResult>(
        '/categories/rules/apply-all',
      );
      return { result: response.data, accepted: response.status === 202 };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.rules.all });
      queryClient.invalidateQueries({ queryKey: qk.transactions.all });
    },
  });
}
