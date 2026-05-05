import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Depot, Position } from '../../api/types';
import Portfolio from '../Portfolio';

const summary = {
  total_value: 100,
  total_purchase_value: 90,
  total_pnl_abs: 10,
  total_pnl_rel: 11.1,
  daily_pnl_abs: 2,
  daily_pnl_rel: 2.0,
  dividend_yield_pct: 1.2,
  positions_count: 2,
  depots_count: 2,
  last_synced_at: null,
};

const makePosition = (depotId: string, isin: string, value: number, weight: number): Position => ({
  depot_id: depotId,
  instrument: {
    isin,
    wkn: null,
    name: `Instrument ${isin}`,
    instrument_type: 'SHARE',
    currency: 'EUR',
  },
  quantity: 1,
  current_price: value,
  current_value: value,
  purchase_value: value,
  prev_day_price: value,
  daily_pnl_abs: 0,
  daily_pnl_rel: 0,
  total_pnl_abs: 0,
  total_pnl_rel: 0,
  weight_pct: weight,
  currency: 'EUR',
  as_of: '2026-05-05',
});

const oneDepot: Depot[] = [
  {
    depot_id: 'D1',
    depot_type: 'Hauptdepot',
    currency: 'EUR',
    total_value: 100,
    total_purchase_value: 90,
    total_pnl_abs: 10,
    total_pnl_rel: 11.1,
    positions_count: 1,
    last_synced_at: null,
  },
];

const twoDepots: Depot[] = [
  { ...oneDepot[0] },
  {
    depot_id: 'D2',
    depot_type: null,
    currency: 'EUR',
    total_value: 50,
    total_purchase_value: 40,
    total_pnl_abs: 10,
    total_pnl_rel: 25,
    positions_count: 1,
    last_synced_at: null,
  },
];

const positionsByDepot = {
  D1: [makePosition('D1', 'DE000ABC123', 60, 100)],
  D2: [makePosition('D2', 'DE000XYZ789', 40, 100)],
};

let depotsMock: Depot[] = oneDepot;

vi.mock('../../api/portfolio', () => ({
  usePortfolioSummary: () => ({ data: summary, isPending: false }),
  usePortfolioAllocation: () => ({ data: [] }),
  usePortfolioPerformance: () => ({ data: [] }),
  useDepots: () => ({ data: depotsMock }),
  useAllPositions: (depots: Depot[] | undefined) => ({
    byDepotId: Object.fromEntries(
      (depots ?? []).map((d) => [d.depot_id, positionsByDepot[d.depot_id as 'D1' | 'D2'] ?? []]),
    ),
    isPending: false,
  }),
}));

function renderPortfolio() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Portfolio />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Portfolio multi-depot', () => {
  it('renders no depot tabs when there is only one depot', () => {
    depotsMock = oneDepot;
    renderPortfolio();
    expect(screen.queryByRole('tablist', { name: /depot-auswahl/i })).not.toBeInTheDocument();
    expect(screen.getByText('Hauptdepot')).toBeInTheDocument();
  });

  it('renders tabs for "Alle Depots" + each depot when there are multiple', () => {
    depotsMock = twoDepots;
    renderPortfolio();
    const tablist = screen.getByRole('tablist', { name: /depot-auswahl/i });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Alle Depots', 'Hauptdepot', 'Depot 2']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('shows positions from all depots by default with weight_pct re-computed', () => {
    depotsMock = twoDepots;
    renderPortfolio();
    expect(screen.getByText('Instrument DE000ABC123')).toBeInTheDocument();
    expect(screen.getByText('Instrument DE000XYZ789')).toBeInTheDocument();
    // 60 of 100 total = 60.0 %, 40 of 100 = 40.0 %
    expect(screen.getByText('60,0 %')).toBeInTheDocument();
    expect(screen.getByText('40,0 %')).toBeInTheDocument();
  });

  it('switches to a single depot when its tab is clicked', async () => {
    depotsMock = twoDepots;
    const user = userEvent.setup();
    renderPortfolio();
    await user.click(screen.getByRole('tab', { name: 'Depot 2' }));
    expect(screen.queryByText('Instrument DE000ABC123')).not.toBeInTheDocument();
    expect(screen.getByText('Instrument DE000XYZ789')).toBeInTheDocument();
  });
});
