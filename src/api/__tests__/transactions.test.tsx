import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '../client';
import { downloadTransactionsCsv } from '../transactions';

describe('downloadTransactionsCsv', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock-url');
    revokeObjectURL = vi.fn();
    // jsdom does not implement these; install minimal shims.
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      configurable: true,
    });
    clickSpy = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('passes filter params + format=csv and triggers a download with the parsed filename', async () => {
    const blob = new Blob(['header\nrow'], { type: 'text/csv' });
    vi.mocked(apiClient.get).mockResolvedValue({
      data: blob,
      headers: { 'content-disposition': 'attachment; filename="transactions-2026-05-05.csv"' },
    } as never);

    await downloadTransactionsCsv({
      category_id: 'groceries',
      search: 'REWE',
      date_from: '2026-04-01',
      date_to: '2026-04-30',
    });

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/transactions/export', {
      params: {
        format: 'csv',
        category_id: 'groceries',
        search: 'REWE',
        date_from: '2026-04-01',
        date_to: '2026-04-30',
      },
      responseType: 'blob',
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('falls back to a default filename when no Content-Disposition header is present', async () => {
    const blob = new Blob(['x']);
    vi.mocked(apiClient.get).mockResolvedValue({ data: blob, headers: {} } as never);

    let captured: string | undefined;
    vi.spyOn(
      HTMLAnchorElement.prototype,
      'download',
      'set',
    ).mockImplementation(function (this: HTMLAnchorElement, value: string) {
      captured = value;
    });

    await downloadTransactionsCsv();

    expect(captured).toBe('transactions.csv');
  });

  it('omits empty filters from the request params', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: new Blob(['x']),
      headers: {},
    } as never);

    await downloadTransactionsCsv();

    expect(apiClient.get).toHaveBeenCalledWith('/transactions/export', {
      params: { format: 'csv' },
      responseType: 'blob',
    });
  });
});
