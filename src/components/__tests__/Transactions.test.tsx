import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { Transaction } from '../../api/types';

// Mock api modules used by the component.
vi.mock('../../api/transactions', () => ({
  useTransactions: vi.fn(),
  useTransactionLinks: vi.fn(),
  useUpdateTransaction: vi.fn(),
  downloadTransactionsCsv: vi.fn(),
}));
vi.mock('../../api/categories', () => ({
  useCategories: vi.fn(),
  useTags: vi.fn(),
}));
vi.mock('../../api/settings', () => ({
  useSettings: vi.fn(),
}));

import {
  useTransactions,
  useTransactionLinks,
  useUpdateTransaction,
  downloadTransactionsCsv,
} from '../../api/transactions';
import { useCategories, useTags } from '../../api/categories';
import { useSettings } from '../../api/settings';
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
  source: 'comdirect',
  external_id: 'CD001',
  booking_date: '2026-04-10',
  valuation_date: '2026-04-10',
  amount: -42.5,
  currency: 'EUR',
  original_amount: null,
  original_currency: null,
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

beforeEach(() => {
  vi.mocked(useTransactionLinks).mockReturnValue({
    data: { transaction_id: 'txn-1', children: [], parents: [] },
    isPending: false,
  } as unknown as ReturnType<typeof useTransactionLinks>);
  vi.mocked(useSettings).mockReturnValue({
    data: { page_size: 25, auto_apply_confidence: 0.6, own_ibans: [] },
  } as unknown as ReturnType<typeof useSettings>);
});

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
    vi.mocked(useTags).mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useTags>);
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

  it('passes tag_ids from the URL to the export helper', async () => {
    const user = userEvent.setup();
    renderTransactions(['/transactions?tag_ids=tag-a,tag-b']);

    await user.click(
      screen.getByRole('button', { name: /transaktionen als csv exportieren/i }),
    );

    await waitFor(() => {
      expect(downloadTransactionsCsv).toHaveBeenCalledTimes(1);
    });
    expect(downloadTransactionsCsv).toHaveBeenCalledWith({
      category_id: undefined,
      tag_ids: ['tag-a', 'tag-b'],
      search: undefined,
    });
  });
});

describe('Transactions — server-side tag filter', () => {
  beforeEach(() => {
    vi.mocked(useUpdateTransaction).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTransaction>);
    vi.mocked(useCategories).mockReturnValue({
      data: [{ id: 'groceries', name: 'Lebensmittel', type: 'variabel' }],
    } as unknown as ReturnType<typeof useCategories>);
    vi.mocked(useTags).mockReturnValue({
      data: [
        { id: 'tag-a', name: 'urlaub' },
        { id: 'tag-b', name: 'business' },
      ],
    } as unknown as ReturnType<typeof useTags>);
    vi.mocked(downloadTransactionsCsv).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('forwards selectedTagIds to useTransactions and trusts the server total', () => {
    vi.mocked(useTransactions).mockReturnValue({
      data: { items: [sampleTx], total: 8, limit: 25, offset: 0 },
      isPending: false,
    } as unknown as ReturnType<typeof useTransactions>);

    renderTransactions(['/transactions?tag_ids=tag-a,tag-b']);

    expect(useTransactions).toHaveBeenCalledWith(
      expect.objectContaining({
        tag_ids: ['tag-a', 'tag-b'],
        limit: 25,
        offset: 0,
      }),
    );
    // Footer reflects the server-reported total — no client-side filter
    // post-step that would mislead the page count.
    expect(screen.getByText(/von\s+8/)).toBeInTheDocument();
    expect(screen.queryByText(/mit Tag-Filter/)).not.toBeInTheDocument();
  });

  it('omits tag_ids from the query when no tags are selected', () => {
    vi.mocked(useTransactions).mockReturnValue({
      data: { items: [sampleTx], total: 1, limit: 25, offset: 0 },
      isPending: false,
    } as unknown as ReturnType<typeof useTransactions>);

    renderTransactions(['/transactions']);

    expect(useTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ tag_ids: undefined }),
    );
  });
});

describe('Transactions — source filter chips', () => {
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
      data: [],
    } as unknown as ReturnType<typeof useCategories>);
    vi.mocked(useTags).mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useTags>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Alle | Bank | PayPal | Santander-CC chips', () => {
    renderTransactions(['/transactions']);
    expect(screen.getByRole('button', { name: 'Alle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bank' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PayPal' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Santander-CC' }),
    ).toBeInTheDocument();
  });

  it('threads the santander_cc source when the Santander-CC chip is clicked', async () => {
    const user = userEvent.setup();
    renderTransactions(['/transactions']);

    await user.click(screen.getByRole('button', { name: 'Santander-CC' }));

    await waitFor(() => {
      expect(useTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: 'santander_cc' }),
      );
    });
  });

  it('defaults to no source filter (the "Alle" chip)', () => {
    renderTransactions(['/transactions']);
    expect(useTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ source: undefined }),
    );
  });

  it('threads the chosen source to useTransactions when a chip is clicked', async () => {
    const user = userEvent.setup();
    renderTransactions(['/transactions']);

    await user.click(screen.getByRole('button', { name: 'PayPal' }));

    await waitFor(() => {
      expect(useTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: 'paypal' }),
      );
    });
  });

  it('reads an existing ?source filter from the URL', () => {
    renderTransactions(['/transactions?source=comdirect']);
    expect(useTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'comdirect' }),
    );
  });
});

describe('Transactions — aggregate links panel', () => {
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
    vi.mocked(useTags).mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useTags>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows child transactions for an aggregate parent', async () => {
    const user = userEvent.setup();
    vi.mocked(useTransactionLinks).mockReturnValue({
      data: {
        transaction_id: 'txn-1',
        children: [
          {
            id: 'link-1',
            link_type: 'paypal_aggregate',
            transaction: {
              ...sampleTx,
              id: 'txn-child',
              source: 'paypal',
              recipient: 'STEAMGAMES',
              description: 'STEAMGAMES',
              internal_transfer: false,
            },
          },
        ],
        parents: [],
      },
      isPending: false,
    } as unknown as ReturnType<typeof useTransactionLinks>);

    renderTransactions();
    await user.click(screen.getByRole('button', { name: /transaktion bearbeiten: rewe/i }));

    expect(screen.getByText('Sammelposten')).toBeInTheDocument();
    expect(screen.getByText('STEAMGAMES')).toBeInTheDocument();
  });

  it('shows the parent transaction for a linked child', async () => {
    const user = userEvent.setup();
    vi.mocked(useTransactionLinks).mockReturnValue({
      data: {
        transaction_id: 'txn-1',
        children: [],
        parents: [
          {
            id: 'link-1',
            link_type: 'paypal_aggregate',
            transaction: {
              ...sampleTx,
              id: 'txn-parent',
              recipient: 'PAYPAL EUROPE',
              description: 'PAYPAL EUROPE',
              internal_transfer: true,
            },
          },
        ],
      },
      isPending: false,
    } as unknown as ReturnType<typeof useTransactionLinks>);

    renderTransactions();
    await user.click(screen.getByRole('button', { name: /transaktion bearbeiten: rewe/i }));

    expect(screen.getByText('Teil von Sammelposten')).toBeInTheDocument();
    expect(screen.getByText('PAYPAL EUROPE')).toBeInTheDocument();
  });

  it('keeps the panel quiet when there are no links', async () => {
    const user = userEvent.setup();

    renderTransactions();
    await user.click(screen.getByRole('button', { name: /transaktion bearbeiten: rewe/i }));

    expect(screen.queryByText('Sammelposten')).not.toBeInTheDocument();
    expect(screen.queryByText('Teil von Sammelposten')).not.toBeInTheDocument();
  });
});
