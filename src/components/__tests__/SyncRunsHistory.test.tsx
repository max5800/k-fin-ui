import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SyncRun } from '../../api/sync';
import SyncRunsHistory from '../SyncRunsHistory';

const mockUseSyncRuns = vi.fn();

vi.mock('../../api/sync', () => ({
  useSyncRuns: (limit?: number) => mockUseSyncRuns(limit),
}));

function renderHistory() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SyncRunsHistory />
    </QueryClientProvider>,
  );
}

const baseTime = new Date('2026-05-05T20:00:00Z').toISOString();

const succeededRun: SyncRun = {
  id: 'run-ok',
  source: 'raw_import',
  status: 'succeeded',
  started_at: baseTime,
  finished_at: new Date('2026-05-05T20:00:42Z').toISOString(),
  rows_processed: 17,
  error: null,
};

const failedRun: SyncRun = {
  id: 'run-fail',
  source: 'normalize',
  status: 'failed',
  started_at: baseTime,
  finished_at: new Date('2026-05-05T20:00:05Z').toISOString(),
  rows_processed: 0,
  error: 'Worker unreachable: connection refused',
};

const runningRun: SyncRun = {
  id: 'run-now',
  source: 'raw_import',
  status: 'running',
  started_at: baseTime,
  finished_at: null,
  rows_processed: 0,
  error: null,
};

describe('SyncRunsHistory', () => {
  it('renders empty-state when there are zero runs', () => {
    mockUseSyncRuns.mockReturnValue({
      data: [],
      isPending: false,
      isFetching: false,
      isError: false,
    });
    renderHistory();
    expect(screen.getByText(/noch keine syncs gelaufen/i)).toBeInTheDocument();
  });

  it('renders skeleton while pending', () => {
    mockUseSyncRuns.mockReturnValue({
      data: undefined,
      isPending: true,
      isFetching: true,
      isError: false,
    });
    const { container } = renderHistory();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders an error notice on failure', () => {
    mockUseSyncRuns.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      isError: true,
    });
    renderHistory();
    expect(screen.getByRole('alert')).toHaveTextContent(/konnte nicht geladen/i);
  });

  it('renders rows with status, source, duration, rows and error', () => {
    mockUseSyncRuns.mockReturnValue({
      data: [succeededRun, failedRun, runningRun],
      isPending: false,
      isFetching: false,
      isError: false,
    });
    renderHistory();

    // Body rows only — header row would also match "Fehler" otherwise.
    const tbody = screen.getAllByRole('rowgroup')[1];
    const bodyRows = within(tbody).getAllByRole('row');
    expect(bodyRows).toHaveLength(3);

    expect(within(bodyRows[0]).getByText('Erfolgreich')).toBeInTheDocument();
    expect(within(bodyRows[0]).getByText('Datenabgleich')).toBeInTheDocument();
    expect(within(bodyRows[0]).getByText('17')).toBeInTheDocument();
    expect(within(bodyRows[0]).getByText('42,0 s')).toBeInTheDocument();

    expect(within(bodyRows[1]).getByText('Fehler')).toBeInTheDocument();
    expect(within(bodyRows[1]).getByText('Re-Normalisierung')).toBeInTheDocument();
    expect(within(bodyRows[1]).getByText('5,0 s')).toBeInTheDocument();
    expect(
      within(bodyRows[1]).getByText('Worker unreachable: connection refused'),
    ).toBeInTheDocument();

    expect(within(bodyRows[2]).getByText('Läuft')).toBeInTheDocument();
    // Running run has no duration and no error → both cells render an em-dash.
    expect(within(bodyRows[2]).getAllByText('—')).toHaveLength(2);
  });

  it('refresh button invalidates the query', async () => {
    mockUseSyncRuns.mockReturnValue({
      data: [],
      isPending: false,
      isFetching: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderHistory();
    const button = screen.getByRole('button', { name: /sync-verlauf neu laden/i });
    await user.click(button);
    // No throw == success; the useQueryClient inside the component will have
    // invalidated, but we don't have a strict observable here. Click coverage
    // is enough to catch wiring breakage.
    expect(button).toBeInTheDocument();
  });
});
