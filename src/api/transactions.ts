import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { qk, type TxFilters } from '../lib/queryKeys';
import type { Transaction, PaginatedResponse } from './types';

export type ExportFilters = Pick<
  TxFilters,
  'from' | 'to' | 'category_id' | 'tag_ids' | 'search'
> & {
  date_from?: string;
  date_to?: string;
};

export type ExportFormat = 'csv' | 'json';

const DEFAULT_FILENAME: Record<ExportFormat, string> = {
  csv: 'transactions.csv',
  json: 'transactions.json',
};

function parseFilenameFromContentDisposition(header: string | undefined): string | null {
  if (!header) return null;
  // RFC 5987 form first.
  const utfMatch = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim());
    } catch {
      // fallthrough to plain form
    }
  }
  const plainMatch = /filename\s*=\s*("([^"]+)"|([^;]+))/i.exec(header);
  const value = plainMatch?.[2] ?? plainMatch?.[3];
  return value ? value.trim() : null;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Download transactions as CSV (default) or JSON, respecting the same filter
 * params as `useTransactions`. Triggers a browser download via a temporary
 * anchor element.
 */
export async function downloadTransactionsCsv(
  filters: ExportFilters = {},
  format: ExportFormat = 'csv',
): Promise<void> {
  const params: Record<string, string | string[]> = { format };
  if (filters.date_from || filters.from) {
    params.date_from = (filters.date_from ?? filters.from) as string;
  }
  if (filters.date_to || filters.to) {
    params.date_to = (filters.date_to ?? filters.to) as string;
  }
  if (filters.category_id) params.category_id = filters.category_id;
  if (filters.tag_ids && filters.tag_ids.length > 0) {
    // Axios serializes arrays via the global paramsSerializer
    // (`indexes: null`) → repeated `?tag_ids=a&tag_ids=b`.
    params.tag_ids = filters.tag_ids;
  }
  if (filters.search) params.search = filters.search;

  const response = await apiClient.get<Blob>('/transactions/export', {
    params,
    responseType: 'blob',
  });

  const headerName =
    (response.headers as { get?: (k: string) => string | null } | undefined)?.get?.(
      'content-disposition',
    ) ??
    (response.headers as Record<string, string> | undefined)?.['content-disposition'];

  const filename =
    parseFilenameFromContentDisposition(headerName ?? undefined) ?? DEFAULT_FILENAME[format];

  const blob =
    response.data instanceof Blob
      ? response.data
      : new Blob([response.data as unknown as BlobPart], {
          type: format === 'csv' ? 'text/csv' : 'application/json',
        });

  triggerBlobDownload(blob, filename);
}

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

export type TransactionPatch = {
  id: string;
  category_id?: string | null;
  tags?: string[];
  is_refund?: boolean;
  internal_transfer?: boolean;
  // True stamps the row as audit-decided; false clears the stamp so the
  // candidate re-surfaces in /review#refunds. Independent of is_refund.
  refund_audit_decided?: boolean;
};

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: TransactionPatch) => {
      const { data: updated } = await apiClient.patch<Transaction>(`/transactions/${id}`, data);
      return updated;
    },
    onSuccess: (data) => {
      // Aggregate views (cashflow, monthly summary, budget spending,
      // refund audit) all derive from the same row — invalidate broadly so
      // the dashboard refreshes after a refund/transfer reclassification.
      queryClient.invalidateQueries({ queryKey: qk.transactions.all });
      queryClient.invalidateQueries({ queryKey: qk.transactions.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: ['aggregates'] });
    },
  });
}
