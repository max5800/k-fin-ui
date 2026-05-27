import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Run, RunStatus } from '../../api/types';
import AgentRuns from '../AgentRuns';

const mockUseRuns = vi.fn();
const mockUseRunHealth = vi.fn();
const mockTriggerRun = vi.fn();
const mockTriggerFull = vi.fn();
const mockCancelRun = vi.fn();
const mockRerunRun = vi.fn();

vi.mock('../../api/runs', () => ({
  useRuns: (filters: unknown) => mockUseRuns(filters),
  useRunHealth: (windowDays: number) => mockUseRunHealth(windowDays),
  useTriggerRun: () => ({
    mutate: mockTriggerRun,
    isPending: false,
    variables: undefined,
  }),
  useTriggerFullPipeline: () => ({
    mutate: mockTriggerFull,
    isPending: false,
  }),
  useCancelRun: () => ({
    mutate: mockCancelRun,
    isPending: false,
    variables: undefined,
  }),
  useRerunRun: () => ({
    mutate: mockRerunRun,
    isPending: false,
    variables: undefined,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('../../api/settings', () => ({
  useSettings: () => ({ data: { page_size: 20 } }),
}));

function renderRuns() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AgentRuns />
    </QueryClientProvider>,
  );
}

const baseTime = new Date('2026-05-05T10:00:00Z').toISOString();

function makeRun(overrides: Partial<Run> & { id: string; status: RunStatus }): Run {
  return {
    id: overrides.id,
    agent_name: 'categorization',
    status: overrides.status,
    trigger: 'manual',
    result: null,
    error: null,
    last_error: null,
    heartbeat_at: null,
    started_at: baseTime,
    finished_at:
      overrides.status === 'pending' || overrides.status === 'running'
        ? null
        : new Date('2026-05-05T10:00:30Z').toISOString(),
    progress_current: null,
    progress_total: null,
    progress_message: null,
    input_tokens: null,
    output_tokens: null,
    cost_usd: null,
    usage_detail: null,
    ...overrides,
  };
}

describe('AgentRuns rerun button', () => {
  beforeEach(() => {
    mockUseRuns.mockReset();
    mockUseRunHealth.mockReset();
    mockUseRunHealth.mockReturnValue({
      data: {
        window_days: 7,
        threshold: 0.6,
        runs_total: 0,
        suggestions_total: 0,
        high_confidence_total: 0,
        auto_apply_rate: null,
        avg_confidence: null,
        memory_batches_total: 0,
        memory_batches_with_hits: 0,
        memory_hit_rate: null,
        memory_hits_total: 0,
        low_conf_with_memory: 0,
        low_conf_without_memory: 0,
        pending_by_source: [],
        pending_total: 0,
      },
      isPending: false,
    });
    mockTriggerRun.mockReset();
    mockTriggerFull.mockReset();
    mockCancelRun.mockReset();
    mockRerunRun.mockReset();
  });

  it('renders a Rerun button on failed rows', () => {
    mockUseRuns.mockReturnValue({
      data: {
        items: [makeRun({ id: 'run-failed', status: 'failed' })],
        total: 1,
        limit: 20,
        offset: 0,
      },
      isPending: false,
    });
    renderRuns();
    const tbody = screen.getAllByRole('rowgroup')[1];
    const rerunButtons = within(tbody).getAllByRole('button', { name: /rerun/i });
    expect(rerunButtons).toHaveLength(1);
  });

  it('renders a Rerun button on cancelled rows', () => {
    mockUseRuns.mockReturnValue({
      data: {
        items: [makeRun({ id: 'run-cancelled', status: 'cancelled' })],
        total: 1,
        limit: 20,
        offset: 0,
      },
      isPending: false,
    });
    renderRuns();
    const tbody = screen.getAllByRole('rowgroup')[1];
    const rerunButtons = within(tbody).getAllByRole('button', { name: /rerun/i });
    expect(rerunButtons).toHaveLength(1);
  });

  it('does not render a Rerun button on succeeded, running, or pending rows', () => {
    mockUseRuns.mockReturnValue({
      data: {
        items: [
          makeRun({ id: 'run-ok', status: 'succeeded' }),
          makeRun({ id: 'run-now', status: 'running' }),
          makeRun({ id: 'run-wait', status: 'pending' }),
        ],
        total: 3,
        limit: 20,
        offset: 0,
      },
      isPending: false,
    });
    renderRuns();
    const tbody = screen.getAllByRole('rowgroup')[1];
    expect(within(tbody).queryByRole('button', { name: /rerun/i })).toBeNull();
  });

  it('clicking Rerun calls the mutation with the row id', async () => {
    mockUseRuns.mockReturnValue({
      data: {
        items: [makeRun({ id: 'run-failed', status: 'failed' })],
        total: 1,
        limit: 20,
        offset: 0,
      },
      isPending: false,
    });
    const user = userEvent.setup();
    renderRuns();
    const tbody = screen.getAllByRole('rowgroup')[1];
    const button = within(tbody).getByRole('button', { name: /rerun/i });
    await user.click(button);
    expect(mockRerunRun).toHaveBeenCalledTimes(1);
    expect(mockRerunRun).toHaveBeenCalledWith('run-failed');
  });

  it('renders the agents health card', () => {
    mockUseRuns.mockReturnValue({
      data: {
        items: [],
        total: 0,
        limit: 20,
        offset: 0,
      },
      isPending: false,
    });
    mockUseRunHealth.mockReturnValue({
      data: {
        window_days: 7,
        threshold: 0.6,
        runs_total: 2,
        suggestions_total: 4,
        high_confidence_total: 3,
        auto_apply_rate: 0.75,
        avg_confidence: 0.7,
        memory_batches_total: 3,
        memory_batches_with_hits: 2,
        memory_hit_rate: 2 / 3,
        memory_hits_total: 5,
        low_conf_with_memory: 1,
        low_conf_without_memory: 1,
        pending_by_source: [
          { source: 'paypal', pending: 1 },
          { source: 'santander_cc', pending: 2 },
        ],
        pending_total: 3,
      },
      isPending: false,
    });

    renderRuns();

    const card = screen.getByLabelText('Agents Health');
    expect(within(card).getByText('75%')).toBeInTheDocument();
    expect(within(card).getByText('67%')).toBeInTheDocument();
    expect(within(card).getByText('3/4')).toBeInTheDocument();
    expect(within(card).getByText('PayPal: 1')).toBeInTheDocument();
    expect(within(card).getByText('Santander: 2')).toBeInTheDocument();
    expect(mockUseRunHealth).toHaveBeenCalledWith(7);
  });
});
