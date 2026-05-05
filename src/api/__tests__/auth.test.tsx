import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from '../client';
import { useLogin, useMe } from '../auth';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useMe', () => {
  it('calls GET /auth/me and returns the user payload', async () => {
    const user = { id: 'u1', email: 'max@example.com', display_name: 'Max', role: 'admin' };
    vi.mocked(apiClient.get).mockResolvedValue({ data: user });

    const { result } = renderHook(() => useMe(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.get).toHaveBeenCalledWith('/auth/me');
    expect(result.current.data).toEqual(user);
  });
});

describe('useLogin', () => {
  it('POSTs credentials to /auth/login and returns the response body', async () => {
    const body = {
      access_token: 'jwt-xyz',
      token_type: 'bearer',
      user: { id: 'u1', email: 'max@example.com', display_name: 'Max', role: 'admin' },
    };
    vi.mocked(apiClient.post).mockResolvedValue({ data: body });

    const { result } = renderHook(() => useLogin(), { wrapper });
    const res = await result.current.mutateAsync({
      email: 'max@example.com',
      password: 'hunter2hunter2',
    });

    expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
      email: 'max@example.com',
      password: 'hunter2hunter2',
    });
    expect(res).toEqual(body);
  });
});
