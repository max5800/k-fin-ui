import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import type {
  AppSettings,
  Budget,
  Category,
  CategoryRule,
  DepotTransaction,
  MonthlySummary,
  PaginatedResponse,
  PendingResponse,
  Run,
  Transaction,
} from '../api/types';
import type { BudgetSpendingOut, RefundAuditOut } from '../api/aggregates';
import type { BackfillRunResponse, LastSync } from '../api/sync';
import { DEMO_DISPLAY_NAME, DEMO_EMAIL, DEMO_TOKEN } from './config';
import {
  loadDemoState,
  resetDemoState,
  saveDemoState,
  wipeDemoState,
  type DemoState,
} from './data';

type Params = URLSearchParams;

const delay = () => new Promise((resolve) => window.setTimeout(resolve, 80));

export const demoAdapter: AxiosAdapter = async (config) => {
  await delay();
  const request = parseRequest(config);
  const method = (config.method ?? 'get').toUpperCase();
  const state = loadDemoState();

  try {
    const data = handleDemoRequest(state, method, request.path, request.params, config);
    return response(config, data, request.status ?? 200);
  } catch (err) {
    if (err instanceof DemoHttpError) {
      throw axiosError(config, err.status, err.message, err.data);
    }
    throw err;
  }
};

class DemoHttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public data: unknown = { detail: message },
  ) {
    super(message);
  }
}

function parseRequest(config: InternalAxiosRequestConfig): {
  path: string;
  params: Params;
  status?: number;
} {
  const base = normalizeBase(config.baseURL ?? '/api/v1');
  const url = config.url ?? '/';
  const absolute = url.startsWith('http')
    ? new URL(url)
    : new URL(`${base.replace(/\/$/, '')}/${url.replace(/^\//, '')}`, 'http://k-fin.demo');
  const params = new URLSearchParams(absolute.search);
  appendParams(params, config.params as Record<string, unknown> | undefined);
  return {
    path: absolute.pathname.replace(/^\/api\/v1/, '') || '/',
    params,
  };
}

function normalizeBase(baseURL: string): string {
  if (baseURL.startsWith('http')) return new URL(baseURL).pathname;
  return baseURL.startsWith('/') ? baseURL : `/${baseURL}`;
}

function appendParams(params: URLSearchParams, extra?: Record<string, unknown>): void {
  if (!extra) return;
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === null || value === '') continue;
    params.delete(key);
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, String(v)));
    } else {
      params.set(key, String(value));
    }
  }
}

function body<T>(config: InternalAxiosRequestConfig): T {
  const data = config.data;
  if (!data) return {} as T;
  if (typeof data === 'string') return JSON.parse(data) as T;
  return data as T;
}

function response<T>(
  config: InternalAxiosRequestConfig,
  data: T,
  status = 200,
): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: statusText(status),
    headers: {},
    config,
    request: { demo: true },
  };
}

function axiosError(
  config: InternalAxiosRequestConfig,
  status: number,
  message: string,
  data: unknown,
): AxiosError {
  return new AxiosError(message, undefined, config, { demo: true }, response(config, data, status));
}

function statusText(status: number): string {
  if (status === 200) return 'OK';
  if (status === 201) return 'Created';
  if (status === 202) return 'Accepted';
  if (status === 204) return 'No Content';
  return 'Demo';
}

function handleDemoRequest(
  state: DemoState,
  method: string,
  path: string,
  params: Params,
  config: InternalAxiosRequestConfig,
): unknown {
  if (method === 'POST' && path === '/auth/login') return loginResponse();
  if (method === 'GET' && path === '/auth/me') return demoUser();
  if (method === 'POST' && path === '/auth/change-password') return {};
  if (method === 'GET' && path === '/meta/version') return { backend_version: 'demo' };

  if (method === 'GET' && path === '/settings') return clone(state.settings);
  if (method === 'PUT' && path === '/settings') return updateSettings(state, body(config));
  if (method === 'POST' && path === '/settings/webhook/test') {
    return { success: true, status_code: 204, error: null };
  }

  if (method === 'GET' && path === '/dev/status') return { enabled: true };
  if (method === 'POST' && path === '/dev/wipe') return wipe(state);
  if (method === 'POST' && path === '/dev/seed') return seed();

  if (method === 'GET' && path === '/categories') return clone(state.categories);
  if (method === 'POST' && path === '/categories') return createCategory(state, body(config));
  if (method === 'DELETE' && path.startsWith('/categories/') && !path.includes('/budgets') && !path.includes('/rules')) {
    return deleteCategory(state, lastSegment(path));
  }
  if (method === 'GET' && path === '/categories/budgets') return clone(state.budgets);
  if (method === 'PUT' && path.startsWith('/categories/budgets/')) {
    return upsertBudget(state, decodeURIComponent(lastSegment(path)), body(config));
  }

  if (method === 'GET' && path === '/tags') return clone(state.tags);
  if (method === 'POST' && path === '/tags') return createTag(state, body(config));
  if (method === 'DELETE' && path.startsWith('/tags/')) return deleteTag(state, lastSegment(path));

  if (method === 'GET' && path === '/categories/rules') return clone(state.rules);
  if (method === 'POST' && path === '/categories/rules') return createRule(state, body(config));
  if (method === 'PATCH' && path.startsWith('/categories/rules/')) {
    return updateRule(state, Number(lastSegment(path)), body(config));
  }
  if (method === 'DELETE' && path.startsWith('/categories/rules/')) return deleteRule(state, Number(lastSegment(path)));
  if (method === 'POST' && path === '/categories/rules/apply-all') {
    return { status: 'done', processed: state.transactions.length, matched: 2, unchanged: state.transactions.length - 2 };
  }

  if (method === 'GET' && path === '/transactions') return listTransactions(state, params);
  if (method === 'GET' && path === '/transactions/export') return exportTransactions(state, params);
  if (method === 'GET' && /^\/transactions\/[^/]+$/.test(path)) return getTransaction(state, lastSegment(path));
  if (method === 'PATCH' && /^\/transactions\/[^/]+$/.test(path)) return patchTransaction(state, lastSegment(path), body(config));
  if (method === 'GET' && path.endsWith('/links') && path.startsWith('/transactions/')) {
    return { transaction_id: path.split('/')[2], children: [], parents: [] };
  }

  if (method === 'GET' && path === '/aggregates/monthly-summary') return monthlySummary(state, params);
  if (method === 'GET' && path === '/aggregates/cashflow-over-time') return cashflow(state, params);
  if (method === 'GET' && path === '/aggregates/budget-spending') return budgetSpending(state, params);
  if (method === 'GET' && path === '/aggregates/refund-audit') return refundAudit(state);

  if (method === 'GET' && path === '/categorization/pending') return pendingSuggestions(state);
  if (method === 'POST' && path.includes('/categorization/pending/') && path.endsWith('/accept')) {
    return acceptSuggestion(state, path.split('/')[3], body(config));
  }
  if (method === 'POST' && path.includes('/categorization/pending/') && path.endsWith('/reject')) return {};

  if (method === 'GET' && path === '/reports') return listReports(state, params);
  if (method === 'GET' && /^\/reports\/[^/]+$/.test(path)) return getReport(state, lastSegment(path));
  if (method === 'GET' && path.startsWith('/reports/') && path.endsWith('/download')) {
    return reportBlob(state, path.split('/')[2]);
  }

  if (method === 'GET' && path === '/runs/health') return runHealth(state, params);
  if (method === 'GET' && path === '/runs') return paginate(state.runs, params);
  if (method === 'GET' && /^\/runs\/[^/]+$/.test(path)) return getRun(state, lastSegment(path));
  if (method === 'POST' && (path === '/runs/full' || /^\/runs\/[^/]+$/.test(path))) return triggerRun(state, path);
  if (method === 'DELETE' && /^\/runs\/[^/]+$/.test(path)) return cancelRun(state, lastSegment(path));
  if (method === 'POST' && path.startsWith('/runs/') && path.endsWith('/rerun')) return rerun(state, path.split('/')[2]);

  if (method === 'POST' && /^\/sync\/[^/]+\/start$/.test(path)) return syncStart(path.split('/')[2]);
  if (method === 'POST' && /^\/sync\/[^/]+\/complete$/.test(path)) return syncComplete(state);
  if (method === 'POST' && path === '/sync/normalize') return {};
  if (method === 'POST' && path === '/sync/backfill/start') return { status: 'requires_tan', session_id: 'demo-backfill-session' };
  if (method === 'POST' && path === '/sync/backfill/confirm') return { status: 'started', run_id: 'demo-backfill-run', target_start_date: '2025-01-01' };
  if (method === 'GET' && path.startsWith('/sync/backfill/runs/')) return backfillRun();
  if (method === 'GET' && path === '/sync/runs') return state.syncRuns.slice(0, numberParam(params, 'limit', 20));
  if (method === 'GET' && path === '/sync/last') return lastSync(state);

  if (method === 'POST' && path === '/import/paypal-csv') return importResult(state, 'paypal');
  if (method === 'POST' && path === '/import/santander-pdf') return { statements: 1, parsed: 3, inserted: 0, duplicates: 3, normalized: state.transactions.length, errors: [] };

  if (method === 'GET' && path === '/portfolio/summary') return portfolioSummary(state);
  if (method === 'GET' && path === '/portfolio/allocation') return clone(state.allocation);
  if (method === 'GET' && path === '/portfolio/performance') return clone(state.performance);
  if (method === 'GET' && path === '/depots') return clone(state.depots);
  if (method === 'GET' && /^\/depots\/[^/]+\/positions$/.test(path)) return clone(state.positionsByDepot[path.split('/')[2]] ?? []);
  if (method === 'GET' && /^\/depots\/[^/]+\/transactions$/.test(path)) return paginate(state.depotTransactionsByDepot[path.split('/')[2]] ?? [], params);
  if (method === 'PATCH' && path.startsWith('/portfolio/instruments/')) return patchInstrument(state, path.split('/')[3], body(config));
  if (method === 'POST' && path.startsWith('/portfolio/instruments/') && path.endsWith('/backfill-prices')) return priceBackfill(path.split('/')[3], body(config));
  if (method === 'GET' && path.startsWith('/portfolio/instruments/') && path.endsWith('/prices')) {
    return clone(state.pricesByIsin[decodeURIComponent(path.split('/')[3])] ?? []);
  }

  throw new DemoHttpError(404, `Demo endpoint not implemented: ${method} ${path}`);
}

function demoUser() {
  return {
    id: 'demo-user',
    email: DEMO_EMAIL,
    display_name: DEMO_DISPLAY_NAME,
    role: 'admin',
    last_login_at: new Date().toISOString(),
  };
}

function loginResponse() {
  return { access_token: DEMO_TOKEN, token_type: 'bearer', user: demoUser() };
}

function updateSettings(state: DemoState, patch: Partial<AppSettings>): AppSettings {
  state.settings = { ...state.settings, ...patch };
  saveDemoState(state);
  return clone(state.settings);
}

function wipe(state: DemoState) {
  const before = state.transactions.length;
  wipeDemoState();
  return { wiped_tables: ['normalized_transactions', 'raw_transactions', 'agent_runs', 'sync_runs', 'reports'], transaction_count_before: before, transaction_count_after: 0 };
}

function seed() {
  const seeded = resetDemoState();
  return seedResult(seeded);
}

function seedResult(state: DemoState) {
  const dates = state.transactions.map((tx) => tx.booking_date).sort();
  return {
    inserted_transactions: state.transactions.length,
    period_start: dates[0] ?? new Date().toISOString().slice(0, 10),
    period_end: dates.at(-1) ?? new Date().toISOString().slice(0, 10),
    refund_count: state.transactions.filter((tx) => tx.is_refund).length,
    internal_transfer_count: state.transactions.filter((tx) => tx.internal_transfer).length,
    outlier_count: state.transactions.filter((tx) => tx.is_outlier).length,
  };
}

function createCategory(state: DemoState, input: Partial<Category>): Category {
  const name = String(input.name ?? 'Neue Kategorie').trim();
  const id = slug(name);
  const category = { id, name, type: input.type ?? 'expense' };
  state.categories.push(category);
  saveDemoState(state);
  return clone(category);
}

function deleteCategory(state: DemoState, id: string) {
  state.categories = state.categories.filter((c) => c.id !== id);
  state.budgets = state.budgets.filter((b) => b.category_id !== id);
  state.transactions = state.transactions.map((tx) => tx.category?.id === id ? { ...tx, category: null } : tx);
  saveDemoState(state);
  return {};
}

function upsertBudget(state: DemoState, categoryId: string, input: Partial<Budget>): Budget {
  const category = categoryById(state, categoryId);
  if (!category) throw new DemoHttpError(404, 'Kategorie nicht gefunden');
  const budget = {
    category_id: categoryId,
    monthly_limit: Number(input.monthly_limit ?? 0),
    currency: input.currency ?? 'EUR',
    category,
  };
  state.budgets = [...state.budgets.filter((b) => b.category_id !== categoryId), budget];
  saveDemoState(state);
  return clone(budget);
}

function createTag(state: DemoState, input: Partial<{ name: string }>) {
  const name = String(input.name ?? 'Neu').trim();
  const tag = { id: slug(name), name };
  state.tags.push(tag);
  saveDemoState(state);
  return clone(tag);
}

function deleteTag(state: DemoState, id: string) {
  state.tags = state.tags.filter((t) => t.id !== id);
  state.transactions = state.transactions.map((tx) => ({ ...tx, tags: tx.tags.filter((t) => t.id !== id) }));
  saveDemoState(state);
  return {};
}

function createRule(state: DemoState, input: Omit<CategoryRule, 'id'>): CategoryRule {
  const next = Math.max(0, ...state.rules.map((r) => r.id)) + 1;
  const rule = { id: next, ...input };
  state.rules.push(rule);
  saveDemoState(state);
  return clone(rule);
}

function updateRule(state: DemoState, id: number, patch: Partial<CategoryRule>): CategoryRule {
  const rule = state.rules.find((r) => r.id === id);
  if (!rule) throw new DemoHttpError(404, 'Regel nicht gefunden');
  Object.assign(rule, patch);
  saveDemoState(state);
  return clone(rule);
}

function deleteRule(state: DemoState, id: number) {
  state.rules = state.rules.filter((r) => r.id !== id);
  saveDemoState(state);
  return {};
}

function listTransactions(state: DemoState, params: Params): PaginatedResponse<Transaction> {
  return paginate(filterTransactions(state.transactions, params), params);
}

function getTransaction(state: DemoState, id: string): Transaction {
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx) throw new DemoHttpError(404, 'Transaktion nicht gefunden');
  return clone(tx);
}

function patchTransaction(state: DemoState, id: string, patch: Record<string, unknown>): Transaction {
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx) throw new DemoHttpError(404, 'Transaktion nicht gefunden');
  if ('category_id' in patch) tx.category = categoryById(state, patch.category_id as string | null);
  if ('is_refund' in patch) tx.is_refund = Boolean(patch.is_refund);
  if ('internal_transfer' in patch) tx.internal_transfer = Boolean(patch.internal_transfer);
  if (Array.isArray(patch.tags)) tx.tags = patch.tags.map((id) => state.tags.find((t) => t.id === id)).filter(Boolean) as Transaction['tags'];
  tx.updated_at = new Date().toISOString();
  saveDemoState(state);
  return clone(tx);
}

function exportTransactions(state: DemoState, params: Params): Blob {
  const rows = filterTransactions(state.transactions, params);
  const format = params.get('format') ?? 'csv';
  if (format === 'json') {
    return new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
  }
  const csv = [
    'booking_date,source,recipient,sender,description,category,amount,currency',
    ...rows.map((tx) => [
      tx.booking_date,
      tx.source,
      tx.recipient ?? '',
      tx.sender ?? '',
      tx.description ?? '',
      tx.category?.name ?? '',
      tx.amount,
      tx.currency,
    ].map(csvCell).join(',')),
  ].join('\n');
  return new Blob([csv], { type: 'text/csv' });
}

function filterTransactions(transactions: Transaction[], params: Params): Transaction[] {
  const categoryId = params.get('category_id');
  const search = (params.get('search') ?? params.get('q') ?? '').toLowerCase();
  const source = params.get('source');
  const isRefund = params.get('is_refund');
  const internalTransfer = params.get('internal_transfer');
  const tagIds = params.getAll('tag_ids').flatMap((v) => v.split(',')).filter(Boolean);
  const from = params.get('date_from') ?? params.get('from');
  const to = params.get('date_to') ?? params.get('to');
  return transactions
    .filter((tx) => !categoryId || tx.category?.id === categoryId)
    .filter((tx) => !source || tx.source === source)
    .filter((tx) => isRefund === null || String(tx.is_refund) === isRefund)
    .filter((tx) => internalTransfer === null || String(tx.internal_transfer) === internalTransfer)
    .filter((tx) => !from || tx.booking_date >= from)
    .filter((tx) => !to || tx.booking_date <= to)
    .filter((tx) => tagIds.length === 0 || tagIds.some((id) => tx.tags.some((tag) => tag.id === id)))
    .filter((tx) => {
      if (!search) return true;
      return [tx.sender, tx.recipient, tx.description, tx.category?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => b.booking_date.localeCompare(a.booking_date));
}

function monthlySummary(state: DemoState, params: Params): MonthlySummary {
  const year = numberParam(params, 'year', new Date().getFullYear());
  const month = numberParam(params, 'month', new Date().getMonth() + 1);
  const txs = state.transactions.filter((tx) => monthMatches(tx.booking_date, year, month));
  return summarize(txs, year, month);
}

function cashflow(state: DemoState, params: Params) {
  const months = numberParam(params, 'months', 12);
  const now = new Date();
  const series = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const summary = summarize(
      state.transactions.filter((tx) => monthMatches(tx.booking_date, d.getFullYear(), d.getMonth() + 1)),
      d.getFullYear(),
      d.getMonth() + 1,
    );
    return {
      year: summary.year,
      month: summary.month,
      income: summary.income,
      expenses: summary.expenses,
      net: summary.net,
      transaction_count: summary.transaction_count,
    };
  });
  return { series, total_months: months };
}

function summarize(txs: Transaction[], year: number, month: number): MonthlySummary {
  const cashflowTxs = txs.filter((tx) => !tx.internal_transfer);
  const income = round2(cashflowTxs.filter((tx) => tx.amount > 0 && !tx.is_refund).reduce((sum, tx) => sum + tx.amount, 0));
  const expenses = round2(cashflowTxs.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + tx.amount, 0));
  const refunds = cashflowTxs.filter((tx) => tx.amount > 0 && tx.is_refund).reduce((sum, tx) => sum + tx.amount, 0);
  const net = round2(income + expenses + refunds);
  const byCategory = new Map<string, { name: string; total: number; count: number }>();
  for (const tx of cashflowTxs) {
    const id = tx.category?.id ?? 'uncategorized';
    const name = tx.category?.name ?? 'Unkategorisiert';
    const current = byCategory.get(id) ?? { name, total: 0, count: 0 };
    current.total += tx.amount;
    current.count += 1;
    byCategory.set(id, current);
  }
  return {
    year,
    month,
    income,
    expenses,
    net,
    savings_rate: income > 0 ? round2(net / income) : 0,
    transaction_count: txs.length,
    by_category: Array.from(byCategory.entries())
      .map(([category_id, value]) => ({ category_id, category_name: value.name, total: round2(value.total), transaction_count: value.count }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
  };
}

function budgetSpending(state: DemoState, params: Params): BudgetSpendingOut {
  const year = numberParam(params, 'year', new Date().getFullYear());
  const month = numberParam(params, 'month', new Date().getMonth() + 1);
  const monthTxs = state.transactions.filter((tx) => monthMatches(tx.booking_date, year, month) && !tx.internal_transfer);
  return {
    year,
    month,
    items: state.budgets.map((budget) => {
      const txs = monthTxs.filter((tx) => tx.category?.id === budget.category_id);
      const spentGross = round2(txs.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + tx.amount, 0));
      const refunded = round2(txs.filter((tx) => tx.amount > 0 && tx.is_refund).reduce((sum, tx) => sum + tx.amount, 0));
      const spentNet = round2(spentGross + refunded);
      return {
        category_id: budget.category_id,
        category_name: budget.category?.name ?? budget.category_id,
        monthly_limit: budget.monthly_limit,
        currency: budget.currency,
        spent_gross: spentGross,
        refunded,
        spent_net: spentNet,
        remaining: round2(budget.monthly_limit - Math.abs(spentNet)),
        transaction_count: txs.length,
      };
    }),
  };
}

function refundAudit(state: DemoState): RefundAuditOut {
  const candidates = state.transactions
    .filter((tx) => tx.amount > 0 && !tx.is_refund && !tx.internal_transfer && tx.category?.type !== 'income')
    .slice(0, 10)
    .map((tx) => ({
      id: tx.id,
      booking_date: tx.booking_date,
      amount: tx.amount,
      sender: tx.sender,
      recipient: tx.recipient,
      description: tx.description,
      suggested_category_id: tx.category?.id ?? null,
      suggested_reason: 'Positive Buchung in einer Ausgabenkategorie',
    }));
  return { candidates, total: candidates.length };
}

function pendingSuggestions(state: DemoState): PendingResponse {
  const items = state.transactions
    .filter((tx) => !tx.category)
    .slice(0, 5)
    .map((tx) => ({
      transaction_id: tx.id,
      transaction: {
        id: tx.id,
        booking_date: tx.booking_date,
        amount: tx.amount,
        sender: tx.sender,
        recipient: tx.recipient,
        description: tx.description,
      },
      suggested_category_id: tx.recipient?.toLowerCase().includes('cafe') ? 'restaurant-cafe' : 'paypal',
      suggested_category_name: tx.recipient?.toLowerCase().includes('cafe') ? 'Restaurant & Cafe' : 'PayPal',
      confidence: 0.78,
      reasoning: 'Demo-Vorschlag aus Empfaenger und Beschreibung.',
      is_refund: false,
    }));
  return { run_id: 'demo-run-categorization', threshold: state.settings.auto_apply_confidence, items };
}

function acceptSuggestion(state: DemoState, id: string, patch: Record<string, unknown>) {
  patchTransaction(state, id, { category_id: patch.category_id ?? 'paypal', is_refund: patch.is_refund });
  return {};
}

function listReports(state: DemoState, params: Params) {
  const type = params.get('report_type');
  return paginate(state.reports.filter((r) => !type || r.report_type === type), params);
}

function getReport(state: DemoState, id: string) {
  const report = state.reports.find((r) => r.id === id);
  if (!report) throw new DemoHttpError(404, 'Report nicht gefunden');
  return clone(report);
}

function reportBlob(state: DemoState, id: string): Blob {
  return new Blob([JSON.stringify(getReport(state, id), null, 2)], { type: 'application/json' });
}

function runHealth(state: DemoState, params: Params) {
  const pending = pendingSuggestions(state).items.length;
  return {
    window_days: numberParam(params, 'window_days', 7),
    threshold: state.settings.auto_apply_confidence,
    runs_total: state.runs.length,
    suggestions_total: 18,
    high_confidence_total: 14,
    auto_apply_rate: 0.74,
    avg_confidence: 0.83,
    memory_batches_total: 4,
    memory_batches_with_hits: 3,
    memory_hit_rate: 0.75,
    memory_hits_total: 9,
    low_conf_with_memory: 1,
    low_conf_without_memory: pending,
    pending_by_source: [{ source: 'paypal', pending }],
    pending_total: pending,
  };
}

function getRun(state: DemoState, id: string): Run {
  const run = state.runs.find((r) => r.id === id);
  if (!run) throw new DemoHttpError(404, 'Run nicht gefunden');
  return clone(run);
}

function triggerRun(state: DemoState, path: string): Run {
  const agent = path === '/runs/full' ? 'synthesis' : lastSegment(path);
  const run: Run = {
    id: `demo-run-${Date.now()}`,
    agent_name: agent,
    status: 'succeeded',
    trigger: 'manual',
    result: { demo: true },
    error: null,
    last_error: null,
    heartbeat_at: null,
    started_at: new Date(Date.now() - 3000).toISOString(),
    finished_at: new Date().toISOString(),
    progress_current: 1,
    progress_total: 1,
    progress_message: null,
    input_tokens: 1000,
    output_tokens: 240,
    cost_usd: '0.0040',
    usage_detail: null,
  };
  state.runs = [run, ...state.runs];
  saveDemoState(state);
  return clone(run);
}

function cancelRun(state: DemoState, id: string) {
  state.runs = state.runs.map((run) => run.id === id ? { ...run, status: 'cancelled', finished_at: new Date().toISOString() } : run);
  saveDemoState(state);
  return {};
}

function rerun(state: DemoState, id: string) {
  const old = getRun(state, id);
  return triggerRun(state, `/runs/${old.agent_name}`);
}

function syncStart(source: string) {
  return {
    status: 'requires_tan',
    session_id: `demo-${source}-session`,
    provider: { source, display_name: sourceLabel(source), tan_kind: 'decoupled_app_push', display_hint: 'Demo TAN' },
  };
}

function syncComplete(state: DemoState) {
  const now = new Date().toISOString();
  state.syncRuns = [{ id: `demo-sync-${Date.now()}`, source: 'raw_import', data_source: 'comdirect', status: 'succeeded', started_at: now, finished_at: now, rows_processed: 0, error: null }, ...state.syncRuns];
  saveDemoState(state);
  return { status: 'succeeded', message: 'Demo-Sync abgeschlossen', ingest: { inserted: 0, normalized: state.transactions.length }, agents: { run_id: 'demo-run-categorization' } };
}

function backfillRun(): BackfillRunResponse {
  return { run_id: 'demo-backfill-run', status: 'succeeded', target_start_date: '2025-01-01', current_window_start: null, windows_total: 4, windows_done: 4, rows_inserted: 0, progress_message: 'Demo abgeschlossen', error: null, started_at: new Date(Date.now() - 10_000).toISOString(), finished_at: new Date().toISOString() };
}

function lastSync(state: DemoState): LastSync[] {
  return state.syncRuns
    .filter((r) => r.data_source && r.status === 'succeeded')
    .map((r) => ({ data_source: r.data_source as LastSync['data_source'], status: r.status, started_at: r.started_at, finished_at: r.finished_at }))
    .slice(0, 3);
}

function importResult(state: DemoState, source: string) {
  return { parsed: source === 'paypal' ? 4 : 3, inserted: 0, duplicates: source === 'paypal' ? 4 : 3, normalized: state.transactions.length };
}

function portfolioSummary(state: DemoState) {
  const totalValue = round2(state.depots.reduce((sum, d) => sum + d.total_value, 0));
  const totalPurchase = round2(state.depots.reduce((sum, d) => sum + d.total_purchase_value, 0));
  const positions = Object.values(state.positionsByDepot).flat();
  const daily = round2(positions.reduce((sum, p) => sum + p.daily_pnl_abs, 0));
  return {
    total_value: totalValue,
    total_purchase_value: totalPurchase,
    total_pnl_abs: round2(totalValue - totalPurchase),
    total_pnl_rel: round2(((totalValue - totalPurchase) / totalPurchase) * 100),
    daily_pnl_abs: daily,
    daily_pnl_rel: round2((daily / totalPurchase) * 100),
    dividend_yield_pct: 2.18,
    positions_count: positions.length,
    depots_count: state.depots.length,
    last_synced_at: state.depots[0]?.last_synced_at ?? null,
  };
}

function patchInstrument(state: DemoState, isin: string, patch: { ticker_symbol?: string | null }) {
  const decoded = decodeURIComponent(isin);
  for (const positions of Object.values(state.positionsByDepot)) {
    const match = positions.find((p) => p.instrument.isin === decoded);
    if (match) {
      match.instrument.ticker_symbol = patch.ticker_symbol ?? null;
      saveDemoState(state);
      return clone(match.instrument);
    }
  }
  throw new DemoHttpError(404, 'Instrument nicht gefunden');
}

function priceBackfill(isin: string, range: { from_date?: string; to_date?: string }) {
  return { isin: decodeURIComponent(isin), ticker_symbol: 'DEMO', requested_from: range.from_date ?? '', requested_to: range.to_date ?? '', fetched_points: 22, inserted_points: 0, skipped_existing: 22, source: 'demo' };
}

function paginate<T>(items: T[], params: Params): PaginatedResponse<T> {
  const limit = numberParam(params, 'limit', 25);
  const offset = numberParam(params, 'offset', 0);
  return { items: clone(items.slice(offset, offset + limit)), total: items.length, limit, offset };
}

function monthMatches(iso: string, year: number, month: number): boolean {
  const d = new Date(`${iso}T00:00:00`);
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

function numberParam(params: Params, name: string, fallback: number): number {
  const value = Number(params.get(name));
  return Number.isFinite(value) ? value : fallback;
}

function categoryById(state: DemoState, id: string | null | undefined): Category | null {
  if (!id) return null;
  return state.categories.find((c) => c.id === id) ?? null;
}

function lastSegment(path: string): string {
  return decodeURIComponent(path.split('/').filter(Boolean).at(-1) ?? '');
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `demo-${Date.now()}`;
}

function csvCell(value: unknown): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function sourceLabel(source: string): string {
  if (source === 'comdirect') return 'Comdirect';
  if (source === 'paypal') return 'PayPal';
  if (source === 'santander_cc') return 'Santander-CC';
  return source;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
