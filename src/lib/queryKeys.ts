export type TxFilters = {
  from?: string;
  to?: string;
  category_id?: string;
  tag_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
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
  },
} as const;
