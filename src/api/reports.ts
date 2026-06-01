import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import { qk } from '../lib/queryKeys';
import type { Report, PaginatedResponse, ReportType } from './types';

type ReportFilters = {
  limit?: number;
  offset?: number;
  report_type?: ReportType | string;
};

export function useReports(filters: ReportFilters = {}) {
  return useQuery({
    // Filter participates in the cache key so changing report_type doesn't
    // hand back a stale "all reports" list.
    queryKey: [...qk.reports.all, filters] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Report>>('/reports', {
        params: filters,
      });
      return data;
    },
  });
}

export function useReport(id: string) {
  return useQuery({
    queryKey: qk.reports.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<Report>(`/reports/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// Parse `attachment; filename="foo.json"` (and the RFC-5987 `filename*=`
// variant) out of a Content-Disposition header. Returns null if absent.
function filenameFromContentDisposition(value: string | null): string | null {
  if (!value) return null;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(value);
  if (star) {
    try {
      return decodeURIComponent(star[1].replace(/^"|"$/g, ''));
    } catch {
      // fall through to plain `filename=`
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(value);
  return plain ? plain[1] : null;
}

export async function downloadReport(id: string): Promise<void> {
  const response = await apiClient.get<Blob>(`/reports/${id}/download`, {
    responseType: 'blob',
  });

  // Backend sets Content-Disposition with the canonical filename
  // (`<report_type>-<period>.json` for JSON content, original file name
  // for disk-backed PDFs/MDs). Trust it instead of guessing the suffix.
  const filename =
    filenameFromContentDisposition(
      (response.headers as { get?: (k: string) => string | null } | undefined)?.get?.(
        'Content-Disposition',
      ) ??
        (response.headers as Record<string, string> | undefined)?.['content-disposition'] ??
        null,
    ) ??
    `report-${id}`;

  const blob = response.data instanceof Blob
    ? response.data
    : new Blob([response.data as unknown as BlobPart], { type: 'application/json' });
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(blobUrl);
}
