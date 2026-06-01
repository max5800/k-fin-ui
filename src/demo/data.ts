import type {
  AllocationBucket,
  AppSettings,
  Budget,
  Category,
  CategoryRule,
  Depot,
  DepotTransaction,
  InstrumentPricePoint,
  PerformancePoint,
  Position,
  Report,
  Run,
  Tag,
  Transaction,
} from '../api/types';
import type { SyncRun } from '../api/sync';

const STORAGE_KEY = 'kfin_demo_state_v1';

export type DemoState = {
  categories: Category[];
  tags: Tag[];
  budgets: Budget[];
  rules: CategoryRule[];
  settings: AppSettings;
  transactions: Transaction[];
  reports: Report[];
  runs: Run[];
  syncRuns: SyncRun[];
  depots: Depot[];
  positionsByDepot: Record<string, Position[]>;
  depotTransactionsByDepot: Record<string, DepotTransaction[]>;
  pricesByIsin: Record<string, InstrumentPricePoint[]>;
  performance: PerformancePoint[];
  allocation: AllocationBucket[];
};

const categoriesSeed: Category[] = [
  { id: 'gehalt', name: 'Gehalt', type: 'income' },
  { id: 'einnahmen-sonstiges', name: 'Sonstige Einnahmen', type: 'income' },
  { id: 'miete', name: 'Miete', type: 'expense' },
  { id: 'internet-telefon', name: 'Internet & Telefon', type: 'expense' },
  { id: 'strom-gas', name: 'Strom & Gas', type: 'expense' },
  { id: 'abos-streaming', name: 'Abos & Streaming', type: 'expense' },
  { id: 'versicherungen', name: 'Versicherungen', type: 'expense' },
  { id: 'etf-sparplan', name: 'ETF-Sparplan', type: 'expense' },
  { id: 'lebensmittel', name: 'Lebensmittel', type: 'expense' },
  { id: 'drogerie', name: 'Drogerie', type: 'expense' },
  { id: 'restaurant-cafe', name: 'Restaurant & Cafe', type: 'expense' },
  { id: 'tanken', name: 'Tanken', type: 'expense' },
  { id: 'gesundheit', name: 'Gesundheit', type: 'expense' },
  { id: 'kleidung', name: 'Kleidung', type: 'expense' },
  { id: 'reisen', name: 'Reisen', type: 'expense' },
  { id: 'elektronik', name: 'Elektronik', type: 'expense' },
  { id: 'paypal', name: 'PayPal', type: 'expense' },
  { id: 'umbuchung', name: 'Umbuchung', type: 'transfer' },
];

const tagsSeed: Tag[] = [
  { id: 'fixkosten', name: 'Fixkosten' },
  { id: 'variabel', name: 'Variabel' },
  { id: 'review', name: 'Review' },
];

const budgetSeed: Array<{ category_id: string; monthly_limit: number }> = [
  { category_id: 'lebensmittel', monthly_limit: 520 },
  { category_id: 'restaurant-cafe', monthly_limit: 260 },
  { category_id: 'drogerie', monthly_limit: 80 },
  { category_id: 'tanken', monthly_limit: 180 },
  { category_id: 'gesundheit', monthly_limit: 120 },
  { category_id: 'abos-streaming', monthly_limit: 50 },
  { category_id: 'reisen', monthly_limit: 250 },
];

const rulesSeed: CategoryRule[] = [
  { id: 1, regex_pattern: 'REWE|EDEKA|ALDI|LIDL', target_category_id: 'lebensmittel', priority: 100 },
  { id: 2, regex_pattern: 'Netflix|Spotify', target_category_id: 'abos-streaming', priority: 90 },
  { id: 3, regex_pattern: 'Apotheke|Krankenkasse', target_category_id: 'gesundheit', priority: 80 },
];

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isoDateTime(date: Date): string {
  return date.toISOString();
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function dateInMonth(month: Date, day: number): string {
  const last = endOfMonth(month).getDate();
  return isoDate(new Date(month.getFullYear(), month.getMonth(), Math.min(day, last)));
}

function categoryById(categories: Category[], id: string | null | undefined): Category | null {
  if (!id) return null;
  return categories.find((c) => c.id === id) ?? null;
}

function tagById(tags: Tag[], id: string): Tag {
  return tags.find((t) => t.id === id) ?? { id, name: id };
}

function createTransactions(now: Date, categories: Category[], tags: Tag[]): Transaction[] {
  const txs: Transaction[] = [];
  let seq = 1;
  const months = Array.from({ length: 6 }, (_, i) => addMonths(now, i - 5));
  const createdAt = isoDateTime(now);

  function push(args: {
    month: Date;
    day: number;
    amount: number;
    source?: string;
    sender?: string | null;
    recipient?: string | null;
    description: string;
    category_id?: string | null;
    tagIds?: string[];
    is_recurring?: boolean;
    is_outlier?: boolean;
    internal_transfer?: boolean;
    is_refund?: boolean;
    original_amount?: number | null;
    original_currency?: string | null;
  }) {
    const id = `demo-tx-${String(seq).padStart(4, '0')}`;
    seq += 1;
    const category = categoryById(categories, args.category_id ?? null);
    txs.push({
      id,
      source: args.source ?? 'comdirect',
      external_id: `DEMO-${id}`,
      booking_date: dateInMonth(args.month, args.day),
      valuation_date: dateInMonth(args.month, args.day),
      amount: args.amount,
      currency: 'EUR',
      original_amount: args.original_amount ?? null,
      original_currency: args.original_currency ?? null,
      sender: args.sender ?? (args.amount > 0 ? 'John Doe' : null),
      recipient: args.recipient ?? (args.amount < 0 ? 'John Doe' : null),
      description: args.description,
      category,
      tags: (args.tagIds ?? []).map((tagId) => tagById(tags, tagId)),
      is_recurring: args.is_recurring ?? false,
      is_outlier: args.is_outlier ?? false,
      internal_transfer: args.internal_transfer ?? false,
      is_refund: args.is_refund ?? false,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  for (const [i, month] of months.entries()) {
    const drift = i - 2;
    push({ month, day: 1, amount: 3300, sender: 'Arbeitgeber GmbH', recipient: 'John Doe', description: 'Gehalt', category_id: 'gehalt', tagIds: ['fixkosten'], is_recurring: true });
    push({ month, day: 2, amount: -1100, sender: 'John Doe', recipient: 'Vermieter Hauser', description: 'Miete', category_id: 'miete', tagIds: ['fixkosten'], is_recurring: true });
    push({ month, day: 3, amount: -45, sender: 'John Doe', recipient: 'Telekom Deutschland', description: 'Internet & Telefon', category_id: 'internet-telefon', tagIds: ['fixkosten'], is_recurring: true });
    push({ month, day: 5, amount: -86.5, sender: 'John Doe', recipient: 'Stadtwerke', description: 'Strom & Gas Abschlag', category_id: 'strom-gas', tagIds: ['fixkosten'], is_recurring: true });
    push({ month, day: 7, amount: -15.99, sender: 'John Doe', recipient: 'Netflix International', description: 'Netflix Monatsabo', category_id: 'abos-streaming', tagIds: ['fixkosten'], is_recurring: true });
    push({ month, day: 12, amount: -9.99, sender: 'John Doe', recipient: 'Spotify AB', description: 'Spotify Premium', category_id: 'abos-streaming', tagIds: ['fixkosten'], is_recurring: true });
    push({ month, day: 15, amount: -75, sender: 'John Doe', recipient: 'Allianz Versicherung', description: 'Hausrat & Haftpflicht', category_id: 'versicherungen', tagIds: ['fixkosten'], is_recurring: true });
    push({ month, day: 25, amount: -300, sender: 'John Doe', recipient: 'ETF-Sparplan', description: 'Sparplan MSCI World', category_id: 'etf-sparplan', tagIds: ['fixkosten'], is_recurring: true });

    push({ month, day: 4, amount: -(72 + drift * 2.5), sender: 'John Doe', recipient: 'REWE', description: 'Wocheneinkauf', category_id: 'lebensmittel', tagIds: ['variabel'] });
    push({ month, day: 11, amount: -(48 + i * 1.75), sender: 'John Doe', recipient: 'EDEKA', description: 'Einkauf', category_id: 'lebensmittel', tagIds: ['variabel'] });
    push({ month, day: 18, amount: -(36 + i * 2.2), sender: 'John Doe', recipient: 'ALDI SUED', description: 'Einkauf', category_id: 'lebensmittel', tagIds: ['variabel'] });
    push({ month, day: 26, amount: -(58 + drift * 1.9), sender: 'John Doe', recipient: 'LIDL', description: 'Wocheneinkauf', category_id: 'lebensmittel', tagIds: ['variabel'] });
    push({ month, day: 9, amount: -(23 + i), sender: 'John Doe', recipient: 'DM Drogerie', description: 'Drogerie', category_id: 'drogerie', tagIds: ['variabel'] });
    push({ month, day: 16, amount: -(65 + i * 1.8), sender: 'John Doe', recipient: i % 2 === 0 ? 'ARAL' : 'Shell', description: 'Tanken', category_id: 'tanken', tagIds: ['variabel'] });
    push({ month, day: 10, amount: -(42 + i * 3.1), sender: 'John Doe', recipient: 'Pizzeria Da Mario', description: 'Restaurant', category_id: 'restaurant-cafe', tagIds: ['variabel'] });
    push({ month, day: 20, amount: -(28 + i * 2.4), sender: 'John Doe', recipient: 'Sushi Yamato', description: 'Restaurant', category_id: 'restaurant-cafe', tagIds: ['variabel'] });

    if (i % 2 === 0) {
      push({ month, day: 22, amount: 24 + i, sender: 'Splitwise Anna Mueller', recipient: 'John Doe', description: 'Splitwise Ausgleich Restaurant', category_id: 'restaurant-cafe', is_refund: true });
    }
    if (i % 3 !== 1) {
      push({ month, day: 13, amount: -(38 + i * 4), sender: 'John Doe', recipient: 'Apotheke am Markt', description: 'Apotheke Rezept', category_id: 'gesundheit' });
      push({ month, day: 24, amount: 21 + i * 2, sender: 'Techniker Krankenkasse', recipient: 'John Doe', description: 'Erstattung Rezept', category_id: 'gesundheit', is_refund: true });
    }

    push({ month, day: 23, amount: -(18 + i * 1.3), source: 'paypal', sender: 'John Doe', recipient: 'PayPal Europe', description: 'Online Einkauf', category_id: 'paypal', tagIds: ['variabel'] });
    push({ month, day: 21, amount: -(34 + i * 2.1), source: 'santander_cc', sender: 'John Doe', recipient: 'BVG Ticket', description: 'Kreditkarte Monatsabrechnung', category_id: 'reisen', original_amount: -(34 + i * 2.1), original_currency: 'EUR' });
    push({ month, day: 28, amount: 4.5 + i * 0.4, sender: 'Visa Cashback Programm', recipient: 'John Doe', description: 'Cashback', category_id: 'einnahmen-sonstiges' });
  }

  const specialMonth = months[Math.max(0, months.length - 3)];
  push({ month: specialMonth, day: 6, amount: -1349, sender: 'John Doe', recipient: 'MediaMarkt', description: 'Laptop Lenovo ThinkPad', category_id: 'elektronik', is_outlier: true, tagIds: ['review'] });
  push({ month: specialMonth, day: 12, amount: -650, sender: 'John Doe', recipient: 'Booking.com', description: 'Wochenende Wien', category_id: 'reisen' });
  push({ month: specialMonth, day: 18, amount: -500, sender: 'John Doe', recipient: 'John Doe Tagesgeld', description: 'Umbuchung Tagesgeld', category_id: 'umbuchung', internal_transfer: true });
  push({ month: specialMonth, day: 18, amount: 500, sender: 'John Doe Tagesgeld', recipient: 'John Doe', description: 'Umbuchung Tagesgeld', category_id: 'umbuchung', internal_transfer: true });
  push({ month: months[Math.max(0, months.length - 2)], day: 2, amount: 89.99, sender: 'Amazon EU', recipient: 'John Doe', description: 'Retoure Schuhe', category_id: 'kleidung', is_refund: true });
  push({ month: months[Math.max(0, months.length - 2)], day: 14, amount: 847.5, sender: 'Finanzamt Muenchen', recipient: 'John Doe', description: 'Einkommensteuer 2025', category_id: 'einnahmen-sonstiges' });
  push({ month: months[months.length - 1], day: 17, amount: -42.35, source: 'paypal', sender: 'John Doe', recipient: 'Unbekannter Haendler', description: 'Noch zu pruefen', category_id: null, tagIds: ['review'] });
  push({ month: months[months.length - 1], day: 19, amount: -18.8, source: 'santander_cc', sender: 'John Doe', recipient: 'Cafe Nomad', description: 'Kartenzahlung Ausland', category_id: null, tagIds: ['review'], original_amount: -20.6, original_currency: 'USD' });

  return txs.sort((a, b) => b.booking_date.localeCompare(a.booking_date));
}

function createPortfolio(now: Date): Pick<DemoState, 'depots' | 'positionsByDepot' | 'depotTransactionsByDepot' | 'pricesByIsin' | 'performance' | 'allocation'> {
  const asOf = isoDate(now);
  const depotId = 'DEMO-DEPOT-1';
  const positions: Position[] = [
    position(depotId, 'DEMOETF00001', 'A1DEMO', 'Vanguard FTSE All-World ETF', 'ETF', 42.5, 112.4, 93.2, 110.9, asOf),
    position(depotId, 'DEMOETF00002', 'A2DEMO', 'iShares Core MSCI EM ETF', 'ETF', 115, 33.8, 31.1, 33.3, asOf),
    position(depotId, 'DEMOSTK00001', 'SAPD0', 'SAP SE', 'Stock', 8, 186.2, 142.5, 184.1, asOf),
    position(depotId, 'DEMOSTK00002', 'APLD0', 'Apple Inc.', 'Stock', 6, 198.5, 166.7, 201.1, asOf),
  ];
  const totalValue = round2(positions.reduce((sum, p) => sum + p.current_value, 0));
  const totalPurchase = round2(positions.reduce((sum, p) => sum + p.purchase_value, 0));
  const depots: Depot[] = [{
    depot_id: depotId,
    depot_type: 'Demo Depot',
    currency: 'EUR',
    total_value: totalValue,
    total_purchase_value: totalPurchase,
    total_pnl_abs: round2(totalValue - totalPurchase),
    total_pnl_rel: round2(((totalValue - totalPurchase) / totalPurchase) * 100),
    positions_count: positions.length,
    last_synced_at: isoDateTime(now),
  }];

  const allocation = allocationFromPositions(positions);
  const performance = Array.from({ length: 18 }, (_, i) => {
    const d = addMonths(now, i - 17);
    const purchase = totalPurchase - 1600 + i * 95;
    const value = purchase * (1.03 + Math.sin(i / 2) * 0.025 + i * 0.004);
    return {
      snapshot_date: isoDate(d),
      total_value: round2(value),
      total_purchase_value: round2(purchase),
    };
  });

  const pricesByIsin: Record<string, InstrumentPricePoint[]> = {};
  for (const p of positions) {
    pricesByIsin[p.instrument.isin] = priceSeries(now, p.current_price, p.currency);
  }

  return {
    depots,
    positionsByDepot: { [depotId]: positions },
    depotTransactionsByDepot: { [depotId]: depotTransactions(now, depotId, positions) },
    pricesByIsin,
    performance,
    allocation,
  };
}

function position(
  depotId: string,
  isin: string,
  wkn: string,
  name: string,
  instrumentType: string,
  quantity: number,
  currentPrice: number,
  purchasePrice: number,
  prevDayPrice: number,
  asOf: string,
): Position {
  const currentValue = round2(quantity * currentPrice);
  const purchaseValue = round2(quantity * purchasePrice);
  const dailyPnlAbs = round2(quantity * (currentPrice - prevDayPrice));
  const totalPnlAbs = round2(currentValue - purchaseValue);
  return {
    depot_id: depotId,
    instrument: {
      isin,
      wkn,
      name,
      instrument_type: instrumentType,
      currency: 'EUR',
      ticker_symbol: isin.includes('STK') ? `${wkn}.DEMO` : `${wkn}.ETF`,
    },
    quantity,
    current_price: currentPrice,
    current_value: currentValue,
    purchase_value: purchaseValue,
    prev_day_price: prevDayPrice,
    daily_pnl_abs: dailyPnlAbs,
    daily_pnl_rel: round2((dailyPnlAbs / purchaseValue) * 100),
    total_pnl_abs: totalPnlAbs,
    total_pnl_rel: round2((totalPnlAbs / purchaseValue) * 100),
    weight_pct: 0,
    currency: 'EUR',
    as_of: asOf,
  };
}

function allocationFromPositions(positions: Position[]): AllocationBucket[] {
  const total = positions.reduce((sum, p) => sum + p.current_value, 0) || 1;
  const byType = new Map<string, number>();
  for (const p of positions) {
    const key = p.instrument.instrument_type ?? 'Sonstige';
    byType.set(key, (byType.get(key) ?? 0) + p.current_value);
  }
  positions.forEach((p) => {
    p.weight_pct = round2((p.current_value / total) * 100);
  });
  return Array.from(byType.entries()).map(([bucket, value]) => ({
    bucket,
    value: round2(value),
    share_pct: round2((value / total) * 100),
  }));
}

function priceSeries(now: Date, currentPrice: number, currency: string): InstrumentPricePoint[] {
  return Array.from({ length: 60 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (59 - i));
    const close = currentPrice * (0.92 + i * 0.0015 + Math.sin(i / 5) * 0.018);
    return {
      price_date: isoDate(d),
      close: round2(close),
      currency,
      source: 'demo',
    };
  });
}

function depotTransactions(now: Date, depotId: string, positions: Position[]): DepotTransaction[] {
  const out: DepotTransaction[] = [];
  let seq = 1;
  for (const p of positions) {
    const buyDate = addMonths(now, -10);
    out.push({
      transaction_id: `demo-depot-tx-${seq++}`,
      depot_id: depotId,
      isin: p.instrument.isin,
      booking_date: isoDate(buyDate),
      transaction_type: 'BUY',
      quantity: p.quantity,
      price: round2(p.purchase_value / p.quantity),
      amount: -p.purchase_value,
      currency: p.currency,
    });
    if (p.instrument.instrument_type === 'ETF') {
      out.push({
        transaction_id: `demo-depot-tx-${seq++}`,
        depot_id: depotId,
        isin: p.instrument.isin,
        booking_date: isoDate(addMonths(now, -2)),
        transaction_type: 'DIVIDEND',
        quantity: 0,
        price: 0,
        amount: round2(p.current_value * 0.008),
        currency: p.currency,
      });
    }
  }
  return out.sort((a, b) => b.booking_date.localeCompare(a.booking_date));
}

function createReports(now: Date): Report[] {
  const previousMonth = addMonths(now, -1);
  const periodStart = isoDate(previousMonth);
  const periodEnd = isoDate(endOfMonth(previousMonth));
  const created = isoDateTime(now);
  return [
    {
      id: 'demo-report-synthesis',
      report_type: 'synthesis',
      title: 'Demo-Synthese',
      period_start: periodStart,
      period_end: periodEnd,
      format: 'json',
      file_path: null,
      size_bytes: 1400,
      status: 'succeeded',
      error: null,
      content: {
        executive_summary: 'Der Monat war trotz Reisebuchung positiv. Fixkosten sind stabil, Lebensmittel liegen leicht unter Budget, Restaurant-Ausgaben werden durch Splitwise-Erstattungen teilweise ausgeglichen.',
        key_observations: [
          { category: 'Budget', summary: 'Lebensmittel bleiben im Rahmen.', severity: 'low', transaction_ids: [], metrics: {} },
          { category: 'Outlier', summary: 'Ein Laptop-Kauf hebt Elektronik-Ausgaben deutlich an.', severity: 'medium', transaction_ids: ['demo-tx-0129'], metrics: { amount: 1349 } },
        ],
        action_items: ['Restaurant-Budget im Auge behalten', 'Laptop-Kauf als Einmalereignis markieren'],
        period: periodStart,
      },
      created_at: created,
      updated_at: created,
    },
    {
      id: 'demo-report-categorization',
      report_type: 'categorization',
      title: 'Kategorisierungsvorschlaege',
      period_start: periodStart,
      period_end: periodEnd,
      format: 'json',
      file_path: null,
      size_bytes: 900,
      status: 'succeeded',
      error: null,
      content: {
        suggestions: [
          { transaction_id: 'demo-tx-0133', suggested_category_id: 'restaurant-cafe', confidence: 0.78, reasoning: 'Cafe im Empfaengertext.' },
        ],
        uncategorized_count: 2,
        high_confidence_count: 1,
      },
      created_at: created,
      updated_at: created,
    },
  ];
}

function createRuns(now: Date): Run[] {
  const finished = isoDateTime(now);
  const started = isoDateTime(new Date(now.getTime() - 90_000));
  return [
    {
      id: 'demo-run-synthesis',
      agent_name: 'synthesis',
      status: 'succeeded',
      trigger: 'scheduled',
      result: { report_id: 'demo-report-synthesis' },
      error: null,
      last_error: null,
      heartbeat_at: null,
      started_at: started,
      finished_at: finished,
      progress_current: 5,
      progress_total: 5,
      progress_message: null,
      input_tokens: 4200,
      output_tokens: 880,
      cost_usd: '0.0180',
      usage_detail: { claude: { model: 'demo-model', input_tokens: 4200, output_tokens: 880, cost_usd: '0.0180' } },
    },
    {
      id: 'demo-run-categorization',
      agent_name: 'categorization',
      status: 'succeeded',
      trigger: 'manual',
      result: { suggestions: 2 },
      error: null,
      last_error: null,
      heartbeat_at: null,
      started_at: isoDateTime(new Date(now.getTime() - 190_000)),
      finished_at: isoDateTime(new Date(now.getTime() - 130_000)),
      progress_current: 2,
      progress_total: 2,
      progress_message: null,
      input_tokens: 2100,
      output_tokens: 420,
      cost_usd: '0.0090',
      usage_detail: null,
    },
  ];
}

function createSyncRuns(now: Date): SyncRun[] {
  return [
    {
      id: 'demo-sync-comdirect',
      source: 'raw_import',
      data_source: 'comdirect',
      status: 'succeeded',
      started_at: isoDateTime(new Date(now.getTime() - 3_600_000)),
      finished_at: isoDateTime(new Date(now.getTime() - 3_540_000)),
      rows_processed: 126,
      error: null,
    },
    {
      id: 'demo-sync-paypal',
      source: 'raw_import',
      data_source: 'paypal',
      status: 'succeeded',
      started_at: isoDateTime(new Date(now.getTime() - 7_200_000)),
      finished_at: isoDateTime(new Date(now.getTime() - 7_150_000)),
      rows_processed: 6,
      error: null,
    },
    {
      id: 'demo-sync-normalize',
      source: 'normalize',
      data_source: null,
      status: 'succeeded',
      started_at: isoDateTime(new Date(now.getTime() - 3_520_000)),
      finished_at: isoDateTime(new Date(now.getTime() - 3_500_000)),
      rows_processed: 132,
      error: null,
    },
  ];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function createDemoState(): DemoState {
  const now = new Date();
  const categories = structuredClone(categoriesSeed);
  const tags = structuredClone(tagsSeed);
  const transactions = createTransactions(now, categories, tags);
  const portfolio = createPortfolio(now);
  return {
    categories,
    tags,
    budgets: budgetSeed.map((b) => ({
      category_id: b.category_id,
      monthly_limit: b.monthly_limit,
      currency: 'EUR',
      category: categoryById(categories, b.category_id),
    })),
    rules: structuredClone(rulesSeed),
    settings: {
      auto_apply_confidence: 0.86,
      page_size: 25,
      webhook_url: null,
      own_ibans: ['DE00000000000000000000'],
    },
    transactions,
    reports: createReports(now),
    runs: createRuns(now),
    syncRuns: createSyncRuns(now),
    ...portfolio,
  };
}

export function loadDemoState(): DemoState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as DemoState;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return resetDemoState();
}

export function saveDemoState(state: DemoState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetDemoState(): DemoState {
  const state = createDemoState();
  saveDemoState(state);
  return state;
}

export function wipeDemoState(): DemoState {
  const state = loadDemoState();
  state.transactions = [];
  state.reports = [];
  state.runs = [];
  state.syncRuns = [];
  saveDemoState(state);
  return state;
}
