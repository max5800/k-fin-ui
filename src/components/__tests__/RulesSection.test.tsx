import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RulesSection, { buildHaystack } from '../RulesSection';
import type {
  Category,
  CategoryRule,
  PaginatedResponse,
  Transaction,
} from '../../api/types';

const mockUseRules = vi.fn();
const mockUseCategories = vi.fn();
const mockUseTransactions = vi.fn();
const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockDeleteMutate = vi.fn();
const mockApplyAllMutate = vi.fn();

vi.mock('../../api/categories', () => ({
  useRules: () => mockUseRules(),
  useCategories: () => mockUseCategories(),
  useCreateRule: () => ({
    mutateAsync: mockCreateMutate,
    isPending: false,
  }),
  useUpdateRule: () => ({
    mutateAsync: mockUpdateMutate,
    isPending: false,
  }),
  useDeleteRule: () => ({
    mutateAsync: mockDeleteMutate,
    isPending: false,
  }),
  useApplyAllRules: () => ({
    mutateAsync: mockApplyAllMutate,
    isPending: false,
  }),
}));

vi.mock('../../api/transactions', () => ({
  useTransactions: (filters: unknown) => mockUseTransactions(filters),
}));

const groceries: Category = { id: 'cat-groceries', name: 'Lebensmittel', type: 'expense' };
const transport: Category = { id: 'cat-transport', name: 'Transport', type: 'expense' };

function makeTx(partial: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction {
  return {
    id: partial.id,
    comdirect_id: null,
    booking_date: '2026-05-01',
    valuation_date: '2026-05-01',
    amount: -12.34,
    currency: 'EUR',
    sender: null,
    recipient: null,
    description: null,
    category: null,
    tags: [],
    is_recurring: false,
    is_outlier: false,
    internal_transfer: false,
    is_refund: false,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    ...partial,
  };
}

const sampleTransactions: Transaction[] = [
  makeTx({ id: 'tx-1', recipient: 'REWE Markt GmbH', description: 'Lastschrift Filiale 7281' }),
  makeTx({ id: 'tx-2', recipient: 'EDEKA Berlin', description: 'POS Einkauf' }),
  makeTx({ id: 'tx-3', recipient: 'BVG Berliner Verkehrsbetriebe', description: 'Monatskarte' }),
  makeTx({ id: 'tx-4', recipient: 'John Doe', description: 'Splitwise Ausgleich' }),
];

const sampleRules: CategoryRule[] = [
  { id: 1, regex_pattern: 'rewe|edeka|aldi', target_category_id: 'cat-groceries', priority: 10 },
  { id: 2, regex_pattern: 'bvg|deutsche bahn', target_category_id: 'cat-transport', priority: 5 },
];

function setDefaultMocks(opts: {
  rules?: CategoryRule[];
  rulesPending?: boolean;
  rulesError?: unknown;
  txs?: Transaction[];
  txTotal?: number;
} = {}) {
  mockUseRules.mockReturnValue({
    data: opts.rules ?? sampleRules,
    isPending: opts.rulesPending ?? false,
    error: opts.rulesError ?? null,
  });
  mockUseCategories.mockReturnValue({
    data: [groceries, transport],
    isPending: false,
  });
  const items = opts.txs ?? sampleTransactions;
  const txPayload: PaginatedResponse<Transaction> = {
    items,
    total: opts.txTotal ?? items.length,
    limit: 500,
    offset: 0,
  };
  mockUseTransactions.mockReturnValue({
    data: txPayload,
    isPending: false,
  });
}

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RulesSection />
    </QueryClientProvider>,
  );
}

describe('RulesSection', () => {
  it('renders an empty-state when there are no rules', () => {
    setDefaultMocks({ rules: [] });
    renderSection();
    expect(screen.getByText(/noch keine regeln angelegt/i)).toBeInTheDocument();
  });

  it('renders existing rules sorted by priority desc', () => {
    setDefaultMocks();
    renderSection();
    const list = screen.getByLabelText('Regel-Liste');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    // Priority 10 (rewe|edeka|aldi) is first.
    expect(within(items[0]).getByText(/rewe\|edeka\|aldi/)).toBeInTheDocument();
    expect(within(items[0]).getByText('Lebensmittel')).toBeInTheDocument();
    expect(within(items[1]).getByText(/bvg\|deutsche bahn/)).toBeInTheDocument();
  });

  it('shows a hint when no pattern is entered yet', () => {
    setDefaultMocks();
    renderSection();
    expect(
      screen.getByText(/tippe ein regex-pattern oben ein/i),
    ).toBeInTheDocument();
  });

  it('flags an invalid regex inline without crashing', async () => {
    setDefaultMocks();
    renderSection();
    const input = screen.getByLabelText(/^regex$/i);
    // userEvent.type interprets `[` as a special key; use fireEvent.change
    // for raw value injection.
    fireEvent.change(input, { target: { value: '[unclosed' } });
    expect(await screen.findByText(/regex ungültig/i)).toBeInTheDocument();
  });

  it('counts and highlights matches against the transaction sample', async () => {
    setDefaultMocks();
    const user = userEvent.setup();
    renderSection();
    const input = screen.getByLabelText(/^regex$/i);
    await user.type(input, 'rewe|edeka');

    // 2 of 4 sample tx match (REWE, EDEKA). Counter lives next to the
    // "Live-Vorschau" header in the aria-live region.
    const previewBox = await screen.findByLabelText('Live-Vorschau-Hits');
    expect(previewBox.textContent).toMatch(/2.*von.*4.*stichprobe/i);

    // Each match line renders a <mark> for the highlighted substring.
    const marks = document.querySelectorAll('mark');
    expect(marks.length).toBeGreaterThanOrEqual(2);
  });

  it('shows the (insgesamt N) hint when total exceeds sample size', async () => {
    setDefaultMocks({ txTotal: 1243 });
    const user = userEvent.setup();
    renderSection();
    const input = screen.getByLabelText(/^regex$/i);
    await user.type(input, 'rewe');
    const previewBox = await screen.findByLabelText('Live-Vorschau-Hits');
    expect(previewBox.textContent).toMatch(/insgesamt.*1\.?243/i);
  });

  it('reports zero matches with an italic line', async () => {
    setDefaultMocks();
    const user = userEvent.setup();
    renderSection();
    const input = screen.getByLabelText(/^regex$/i);
    await user.type(input, 'shouldnotmatchanything12345');
    expect(
      await screen.findByText(/keine treffer in der stichprobe/i),
    ).toBeInTheDocument();
  });

  it('switches to edit mode when Edit is clicked and prefills the form', async () => {
    setDefaultMocks();
    const user = userEvent.setup();
    renderSection();
    const editBtn = screen.getByLabelText('Regel #1 bearbeiten');
    await user.click(editBtn);
    const regexInput = screen.getByLabelText(/^regex$/i) as HTMLInputElement;
    expect(regexInput.value).toBe('rewe|edeka|aldi');
    // Submit button label flips to "Aktualisieren".
    expect(
      screen.getByRole('button', { name: /aktualisieren/i }),
    ).toBeInTheDocument();
    // Cancel button appears.
    expect(
      screen.getByRole('button', { name: /^abbrechen$/i }),
    ).toBeInTheDocument();
  });

  it('calls createRule on submit with a valid regex', async () => {
    setDefaultMocks({ rules: [] });
    mockCreateMutate.mockResolvedValue({});
    const user = userEvent.setup();
    renderSection();
    await user.type(screen.getByLabelText(/^regex$/i), 'spotify|netflix');
    await user.click(screen.getByRole('button', { name: /regel anlegen/i }));
    expect(mockCreateMutate).toHaveBeenCalledWith({
      regex_pattern: 'spotify|netflix',
      target_category_id: 'cat-groceries',
      priority: 0,
    });
  });

  it('opens delete-confirm dialog and calls deleteRule', async () => {
    setDefaultMocks();
    mockDeleteMutate.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByLabelText('Regel #2 löschen'));
    expect(
      await screen.findByText(/regel löschen\?/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^löschen$/i }));
    expect(mockDeleteMutate).toHaveBeenCalledWith(2);
  });
});

describe('buildHaystack', () => {
  it('joins sender, recipient, description with separators and skips nulls', () => {
    expect(
      buildHaystack(
        makeTx({
          id: 't',
          sender: 'A',
          recipient: 'B',
          description: 'C',
        }),
      ),
    ).toBe('A · B · C');
    expect(
      buildHaystack(
        makeTx({
          id: 't',
          sender: null,
          recipient: 'B',
          description: null,
        }),
      ),
    ).toBe('B');
  });
});
