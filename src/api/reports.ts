import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import { qk } from '../lib/queryKeys';
import type { Report, PaginatedResponse } from './types';

export function useReports(filters: { limit?: number; offset?: number } = {}) {
  return useQuery({
    queryKey: qk.reports.all,
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

export function downloadReport(id: string) {
  const url = `${apiClient.defaults.baseURL}/reports/${id}/download`;
  const token = localStorage.getItem('kfin_token');
  
  // Custom download helper since it requires auth header
  fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => response.blob())
  .then(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${id}.pdf`; // or .md
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  })
  .catch(console.error);
}
