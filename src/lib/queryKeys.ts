export type TxFilters = {
  from?: string;
  to?: string;
  category_id?: string;
  // Multi-tag OR-filter. FastAPI accepts repeated `?tag_ids=a&tag_ids=b`;
  // axios serializes the array via `paramsSerializer: { indexes: null }`
  // configured on `apiClient`.
  tag_ids?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  // Tri-state booleans encoded as 'true' | 'false' strings — matches the
  // shape FastAPI accepts on `?is_refund=true|false` and lets us round-trip
  // through URLSearchParams without losing 'undefined' as 'all'.
  is_refund?: 'true' | 'false';
  internal_transfer?: 'true' | 'false';
};

export type RunFilters = {
  limit?: number;
  offset?: number;
  status?: string;
  agent?: string;
};

export const qk = {
  transactions: {
    all: ['transactions'] as const,
    list: (filters: TxFilters) => ['transactions', 'list', filters] as const,
    detail: (id: string) => ['transactions', 'detail', id] as const,
  },
  categories: { 
    all: ['categories'] as const, 
    budgets: ['categories', 'budgets'] as const 
  },
  tags: {
    all: ['tags'] as const,
  },
  rules: {
    all: ['rules'] as const,
  },
  runs: { 
    all: ['runs'] as const, 
    list: (f: RunFilters) => ['runs', 'list', f] as const,
    detail: (id: string) => ['runs', 'detail', id] as const 
  },
  reports: { 
    all: ['reports'] as const, 
    detail: (id: string) => ['reports', id] as const 
  },
  aggregates: {
    monthly: (y: number, m: number) => ['aggregates', 'monthly', y, m] as const,
    cashflow: (months: number) => ['aggregates', 'cashflow', months] as const,
  },
  settings: {
    all: ['settings'] as const,
  },
  categorization: {
    pending: ['categorization', 'pending'] as const,
  },
  portfolio: {
    summary: ['portfolio', 'summary'] as const,
    allocation: ['portfolio', 'allocation'] as const,
    performance: (range: string) => ['portfolio', 'performance', range] as const,
    depots: ['portfolio', 'depots'] as const,
    positions: (depotId: string | null) =>
      ['portfolio', 'positions', depotId] as const,
    // Cached daily close-prices for one instrument over an optional
    // date window. ``from`` / ``to`` are ISO date strings (yyyy-MM-dd)
    // or ``null`` for an open-ended range.
    prices: (isin: string, from: string | null, to: string | null) =>
      ['portfolio', 'prices', isin, from, to] as const,
    // Whole-instrument cache key family — used as an invalidation root
    // after PATCH ticker_symbol or POST backfill-prices, so every prices
    // query for that ISIN refetches regardless of date window.
    instrument: (isin: string) => ['portfolio', 'instrument', isin] as const,
    // Depot-scoped transaction list (BUY/SELL/DIVIDEND/OTHER). Backend
    // currently has no per-ISIN filter param, so the panel filters
    // client-side after fetching the depot's recent slice. ``limit`` is
    // baked into the key so a wider fetch invalidates separately.
    depotTransactions: (depotId: string, limit: number) =>
      ['portfolio', 'depot-transactions', depotId, limit] as const,
  },
} as const;
