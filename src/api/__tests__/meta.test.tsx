import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '../client';
import { FRONTEND_VERSION, useAppVersion } from '../meta';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useAppVersion', () => {
  it('GETs /meta/version', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { backend_version: 'v2.3.4' },
    });

    const { result } = renderHook(() => useAppVersion(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.get).toHaveBeenCalledWith('/meta/version');
    expect(result.current.data).toEqual({ backend_version: 'v2.3.4' });
  });

  it('exposes the build-time frontend version', () => {
    expect(FRONTEND_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
