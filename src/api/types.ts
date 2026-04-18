export type Category = {
  id: string;
  name: string;
  type: string;
};

export type Tag = {
  id: string;
  name: string;
};

export type Transaction = {
  id: string;
  comdirect_id: string | null;
  booking_date: string;
  valuation_date: string;
  amount: number;
  currency: string;
  sender: string | null;
  recipient: string | null;
  description: string | null;
  category: Category | null;
  tags: Tag[];
  is_recurring: boolean;
  is_outlier: boolean;
  internal_transfer: boolean;
  created_at: string;
  updated_at: string;
};

export type Budget = {
  category_id: string;
  monthly_limit: number;
  currency: string;
  category: Category | null;
};

export type AgentName =
  | 'categorization'
  | 'weekly_analysis'
  | 'monthly_analysis'
  | 'anomaly'
  | 'synthesis';

export type RunStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export type UsageBreakdownEntry = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: string;
};

export type Run = {
  id: string;
  agent_name: string;
  status: RunStatus;
  trigger: string;
  result: Record<string, unknown> | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  progress_current: number | null;
  progress_total: number | null;
  progress_message: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: string | null;
  usage_detail: Record<string, UsageBreakdownEntry> | null;
};

export type AppSettings = {
  auto_apply_confidence: number;
};

export type PendingTransactionPreview = {
  id: string;
  booking_date: string;
  amount: number;
  sender: string | null;
  recipient: string | null;
  description: string | null;
};

export type PendingSuggestion = {
  transaction_id: string;
  transaction: PendingTransactionPreview;
  suggested_category_id: string;
  suggested_category_name: string | null;
  confidence: number;
  reasoning: string;
};

export type PendingResponse = {
  run_id: string | null;
  threshold: number;
  items: PendingSuggestion[];
};

export type Report = {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  format: string;
  file_path: string | null;
  size_bytes: number | null;
  status: string;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type CashflowPoint = {
  year: number;
  month: number;
  income: number;
  expenses: number;
  net: number;
  transaction_count: number;
};

export type CashflowOverTime = {
  series: CashflowPoint[];
  total_months: number;
};

export type CategoryBreakdown = {
  category_id: string;
  category_name: string;
  total: number;
  transaction_count: number;
};

export type MonthlySummary = {
  year: number;
  month: number;
  income: number;
  expenses: number;
  net: number;
  savings_rate: number;
  transaction_count: number;
  by_category: CategoryBreakdown[];
};

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};
