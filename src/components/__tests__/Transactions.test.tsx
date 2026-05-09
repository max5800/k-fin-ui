import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { Transaction } from '../../api/types';

// Mock api modules used by the component.
vi.mock('../../api/transactions', () => ({
  useTransactions: vi.fn(),
  useUpdateTransaction: vi.fn(),
  downloadTransactionsCsv: vi.fn(),
}));
vi.mock('../../api/categories', () => ({
  useCategories: vi.fn(),
}));

import {
  useTransactions,
  useUpdateTransaction,
  downloadTransactionsCsv,
} from '../../api/transactions';
import { useCategories } from '../../api/categories';
import Transactions from '../Transactions';

function renderTransactions(initialEntries: string[] = ['/transactions']) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>
        <Transactions />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const sampleTx: Transaction = {
  id: 'txn-1',
  comdirect_id: 'CD001',
  booking_date: '2026-04-10',
  valuation_date: '2026-04-10',
  amount: -42.5,
  currency: 'EUR',
  sender: 'John Doe',
  recipient: 'REWE',
  description: 'Einkauf',
  category: { id: 'groceries', name: 'Lebensmittel', type: 'variabel' },
  tags: [],
  is_recurring: false,
  is_outlier: false,
  internal_transfer: false,
  is_refund: false,
  created_at: '2026-04-10T00:00:00Z',
  updated_at: '2026-04-10T00:00:00Z',
};

describe('Transactions — CSV-Export-Button', () => {
  beforeEach(() => {
    vi.mocked(useTransactions).mockReturnValue({
      data: { items: [sampleTx], total: 1, limit: 25, offset: 0 },
      isPending: false,
    } as unknown as ReturnType<typeof useTransactions>);
    vi.mocked(useUpdateTransaction).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTransaction>);
    vi.mocked(useCategories).mockReturnValue({
      data: [{ id: 'groceries', name: 'Lebensmittel', type: 'variabel' }],
    } as unknown as ReturnType<typeof useCategories>);
    vi.mocked(downloadTransactionsCsv).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the CSV export button', () => {
    renderTransactions();
    expect(
      screen.getByRole('button', { name: /transaktionen als csv exportieren/i }),
    ).toBeInTheDocument();
  });

  it('calls the helper with the current category and search filters when clicked', async () => {
    const user = userEvent.setup();
    renderTransactions(['/transactions?category_id=groceries&q=REWE']);

    const button = screen.getByRole('button', {
      name: /transaktionen als csv exportieren/i,
    });
    await user.click(button);

    await waitFor(() => {
      expect(downloadTransactionsCsv).toHaveBeenCalledTimes(1);
    });
    expect(downloadTransactionsCsv).toHaveBeenCalledWith({
      category_id: 'groceries',
      search: 'REWE',
    });
  });

  it('shows an error notice when the export fails', async () => {
    vi.mocked(downloadTransactionsCsv).mockRejectedValueOnce(
      new Error('Server kaputt'),
    );
    const user = userEvent.setup();
    renderTransactions();

    await user.click(
      screen.getByRole('button', { name: /transaktionen als csv exportieren/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/server kaputt/i);
    });
  });
});
