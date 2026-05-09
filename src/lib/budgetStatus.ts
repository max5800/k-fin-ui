import type { Budget } from '../api/types';

export type BudgetTier =
  | 'critical'
  | 'warning'
  | 'no-budget-spend'
  | 'on-track'
  | 'idle';

export type BudgetRow = {
  id: string;
  name: string;
  type: string;
  spent: number;
  txCount: number;
  budget: Budget | null;
  // Refund-aware breakdown (optional — only set for budgeted categories
  // sourced from /aggregates/budget-spending). `refunded` is the positive
  // sum of is_refund=True transactions, `spentGross` the negative sum of
  // original expenses.
  refunded?: number;
  spentGross?: number;
};

export function classifyTier(row: BudgetRow): BudgetTier {
  const limit = row.budget?.monthly_limit ?? 0;
  if (limit > 0 && row.spent > limit) return 'critical';
  if (limit > 0 && row.spent / limit > 0.8) return 'warning';
  if (limit === 0 && row.spent > 0) return 'no-budget-spend';
  if (limit > 0) return 'on-track';
  return 'idle';
}

const TIER_RANK: Record<BudgetTier, number> = {
  critical: 0,
  warning: 1,
  'no-budget-spend': 2,
  'on-track': 3,
  idle: 4,
};

export function compareRowsByAttention(a: BudgetRow, b: BudgetRow): number {
  const ta = classifyTier(a);
  const tb = classifyTier(b);
  if (TIER_RANK[ta] !== TIER_RANK[tb]) return TIER_RANK[ta] - TIER_RANK[tb];
  if (ta === 'critical') {
    return (
      b.spent - (b.budget?.monthly_limit ?? 0) -
      (a.spent - (a.budget?.monthly_limit ?? 0))
    );
  }
  if (ta === 'warning') {
    const ra = a.spent / (a.budget?.monthly_limit || 1);
    const rb = b.spent / (b.budget?.monthly_limit || 1);
    return rb - ra;
  }
  if (ta === 'idle') {
    return a.name.localeCompare(b.name);
  }
  return b.spent - a.spent;
}
