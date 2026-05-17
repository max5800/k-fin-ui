import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useImportPaypalCsv } from '../imports';

const mockPost = vi.fn();

vi.mock('../client', () => ({
  apiClient: { post: (...args: unknown[]) => mockPost(...args) },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useImportPaypalCsv', () => {
  beforeEach(() => mockPost.mockReset());

  it('posts the file as multipart form-data to /import/paypal-csv', async () => {
    mockPost.mockResolvedValue({
      data: { parsed: 3, inserted: 3, duplicates: 0, normalized: 3 },
    });
    const { result } = renderHook(() => useImportPaypalCsv(), { wrapper });

    const file = new File(['x'], 'kontoauszug.csv', { type: 'text/csv' });
    const res = await result.current.mutateAsync(file);

    expect(res).toEqual({ parsed: 3, inserted: 3, duplicates: 0, normalized: 3 });
    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/import/paypal-csv');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBeInstanceOf(File);
  });

  it('invalidates only the import-affected key families, not the whole cache', async () => {
    mockPost.mockResolvedValue({
      data: { parsed: 1, inserted: 1, duplicates: 0, normalized: 1 },
    });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const spy = vi.spyOn(qc, 'invalidateQueries');
    function scopedWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useImportPaypalCsv(), {
      wrapper: scopedWrapper,
    });

    await result.current.mutateAsync(
      new File(['x'], 'kontoauszug.csv', { type: 'text/csv' }),
    );

    const invalidatedRoots = spy.mock.calls.map(
      ([arg]) => (arg as { queryKey: unknown[] }).queryKey[0],
    );
    expect(invalidatedRoots).toEqual(
      expect.arrayContaining([
        'transactions',
        'aggregates',
        'categorization',
        'sync-runs',
        'sync-last',
      ]),
    );
    // No bare invalidateQueries() that would nuke the whole cache.
    expect(
      spy.mock.calls.every(([arg]) => arg !== undefined),
    ).toBe(true);
  });
});
