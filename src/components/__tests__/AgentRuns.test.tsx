import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Run, RunStatus } from '../../api/types';
import AgentRuns from '../AgentRuns';

const mockUseRuns = vi.fn();
const mockTriggerRun = vi.fn();
const mockTriggerFull = vi.fn();
const mockCancelRun = vi.fn();
const mockRerunRun = vi.fn();

vi.mock('../../api/runs', () => ({
  useRuns: (filters: unknown) => mockUseRuns(filters),
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
});
