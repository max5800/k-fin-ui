export interface UserPublic {
  id: string;
  email: string;
  display_name: string;
  role: string;
  last_login_at: string | null;
}

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

export type RunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

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
  last_error: string | null;
  heartbeat_at: string | null;
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

export type ReportType =
  | 'categorization'
  | 'weekly_analysis'
  | 'monthly_analysis'
  | 'anomaly'
  | 'synthesis';

// Shape of a CategorizationResult.suggestions[] entry as persisted in
// Report.content. Mirrors `src/agents/types.py::CategorySuggestion`.
export type CategorySuggestionContent = {
  transaction_id: string;
  suggested_category_id: string;
  confidence: number;
  reasoning: string;
};

export type CategorizationContent = {
  suggestions: CategorySuggestionContent[];
  uncategorized_count: number;
  high_confidence_count: number;
};

export type ObservationContent = {
  category: string;
  summary: string;
  severity: string;
  transaction_ids: string[];
  metrics: Record<string, unknown>;
};

export type AnalysisContent = {
  observations: ObservationContent[];
  period: string;
  summary_text: string;
};

export type AnomalyContent = {
  anomalies: ObservationContent[];
  period: string;
  total_anomalies: number;
  new_counterparties: string[];
};

export type SynthesisContent = {
  executive_summary: string;
  key_observations: ObservationContent[];
  action_items: string[];
  period: string;
};

export type ReportContent =
  | CategorizationContent
  | AnalysisContent
  | AnomalyContent
  | SynthesisContent
  | Record<string, unknown>;

export type Report = {
  id: string;
  report_type: ReportType | string;
  title: string;
  period_start: string;
  period_end: string;
  format: string;
  file_path: string | null;
  size_bytes: number | null;
  status: string;
  error: string | null;
  content: ReportContent | null;
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

// ── Portfolio / Depot ──────────────────────────────────────────

export type Depot = {
  depot_id: string;
  depot_type: string | null;
  currency: string;
  total_value: number;
  total_purchase_value: number;
  total_pnl_abs: number;
  total_pnl_rel: number;
  positions_count: number;
  last_synced_at: string | null;
};

export type Instrument = {
  isin: string;
  wkn: string | null;
  name: string;
  instrument_type: string | null;
  currency: string;
};

export type Position = {
  depot_id: string;
  instrument: Instrument;
  quantity: number;
  current_price: number;
  current_value: number;
  purchase_value: number;
  prev_day_price: number | null;
  daily_pnl_abs: number;
  daily_pnl_rel: number;
  total_pnl_abs: number;
  total_pnl_rel: number;
  weight_pct: number;
  currency: string;
  as_of: string;
};

export type DepotTransactionType = 'BUY' | 'SELL' | 'DIVIDEND' | 'OTHER';

export type DepotTransaction = {
  transaction_id: string;
  depot_id: string;
  isin: string | null;
  booking_date: string;
  transaction_type: DepotTransactionType;
  quantity: number;
  price: number;
  amount: number;
  currency: string;
};

export type PortfolioSummary = {
  total_value: number;
  total_purchase_value: number;
  total_pnl_abs: number;
  total_pnl_rel: number;
  daily_pnl_abs: number;
  daily_pnl_rel: number;
  dividend_yield_pct: number;
  positions_count: number;
  depots_count: number;
  last_synced_at: string | null;
};

export type AllocationBucket = {
  bucket: string;
  value: number;
  share_pct: number;
};

export type PerformancePoint = {
  snapshot_date: string;
  total_value: number;
  total_purchase_value: number;
};

export type PerformanceRange = '1D' | '1W' | '1M' | '1Y' | 'MAX';
