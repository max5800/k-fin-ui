import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Edit3,
  HelpCircle,
  Plus,
  Tag as TagIcon,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useBudgets,
  useCategories,
  useUpsertBudget,
} from '../api/categories';
import { useBudgetSpending, useMonthlySummary } from '../api/aggregates';
import { formatCurrency } from '../lib/format';
import type { Budget, CategoryBreakdown } from '../api/types';
import {
  classifyTier,
  compareRowsByAttention,
  type BudgetRow,
  type BudgetTier,
} from '../lib/budgetStatus';

const MONTH_LONG_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const budgetSchema = z.object({
  category_id: z.string().min(1),
  monthly_limit: z.coerce.number().min(1, 'Limit muss positiv sein'),
  currency: z.string().default('EUR'),
});

type BudgetFormData = z.infer<typeof budgetSchema>;
type BudgetFormInput = z.input<typeof budgetSchema>;

export default function Categories() {
  const now = new Date();
  const [selected, setSelected] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<BudgetTier | null>(null);
  const [showIdle, setShowIdle] = useState(false);

  const { data: summary } = useMonthlySummary(selected.year, selected.month);
  const { data: categories, isPending } = useCategories();
  const { data: budgets } = useBudgets();
  // Refund-aware per-budget spend: lets us surface "Apotheke 50 € − Krankenkasse-
  // Erstattung 30 € = 20 € netto verbraucht" instead of only the netted total.
  const { data: budgetSpending } = useBudgetSpending(selected.year, selected.month);
  const { mutate: upsertBudget, isPending: isSaving } = useUpsertBudget();

  const monthLabel = `${MONTH_LONG_DE[selected.month - 1]} ${selected.year}`;
  const isCurrentMonth =
    selected.year === now.getFullYear() && selected.month === now.getMonth() + 1;

  const rows = useMemo<BudgetRow[]>(() => {
    if (!categories) return [];
    const breakdownByCat = new Map<string, CategoryBreakdown>();
    for (const c of summary?.by_category ?? []) {
      breakdownByCat.set(c.category_id, c);
    }
    const budgetByCat = new Map<string, Budget>();
    for (const b of budgets ?? []) {
      budgetByCat.set(b.category_id, b);
    }
    // /budget-spending is refund-aware and authoritative for budgeted
    // categories — its `spent_net` already nets refunds against expenses,
    // and we surface `refunded` separately so the UI can show the split.
    const spendingByCat = new Map<string, { gross: number; refunded: number; net: number; count: number }>();
    for (const item of budgetSpending?.items ?? []) {
      spendingByCat.set(item.category_id, {
        gross: item.spent_gross,
        refunded: item.refunded,
        net: item.spent_net,
        count: item.transaction_count,
      });
    }
    return categories.map<BudgetRow>((c) => {
      const breakdown = breakdownByCat.get(c.id);
      const spending = spendingByCat.get(c.id);
      // Prefer the refund-aware figure for budgeted rows; fall back to the
      // monthly-summary breakdown for unbudgeted categories so the rest of
      // the page (uncategorized tally, idle categories) keeps working.
      const spent = spending
        ? Math.abs(spending.net)
        : breakdown
          ? Math.abs(breakdown.total)
          : 0;
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        spent,
        txCount: spending?.count ?? breakdown?.transaction_count ?? 0,
        budget: budgetByCat.get(c.id) ?? null,
        refunded: spending?.refunded,
        spentGross: spending ? Math.abs(spending.gross) : undefined,
      };
    });
  }, [categories, summary, budgets, budgetSpending]);

  const expenseRows = useMemo(
    () => rows.filter((r) => r.type !== 'income'),
    [rows],
  );

  const totalExpense = Math.abs(summary?.expenses ?? 0);
  const totalBudgeted = (budgets ?? []).reduce((acc, b) => acc + b.monthly_limit, 0);
  const spendInBudgeted = expenseRows
    .filter((r) => r.budget !== null)
    .reduce((s, r) => s + r.spent, 0);
  const remainingInBudgets = totalBudgeted - spendInBudgeted;
  const categorizedExpense = expenseRows.reduce((s, r) => s + r.spent, 0);
  const uncategorized = Math.max(0, totalExpense - categorizedExpense);
  const spendOutsideBudgets = Math.max(0, totalExpense - spendInBudgeted);
  const coverageRatio = totalExpense > 0 ? spendInBudgeted / totalExpense : 0;

  const tierCounts = useMemo(() => {
    const c: Record<BudgetTier, number> = {
      critical: 0,
      warning: 0,
      'no-budget-spend': 0,
      'on-track': 0,
      idle: 0,
    };
    for (const r of expenseRows) c[classifyTier(r)]++;
    return c;
  }, [expenseRows]);

  const sortedRows = useMemo(
    () => [...rows].sort(compareRowsByAttention),
    [rows],
  );

  const idleCount = useMemo(
    () => sortedRows.filter((r) => classifyTier(r) === 'idle').length,
    [sortedRows],
  );

  const visibleRows = useMemo(() => {
    let xs = sortedRows;
    if (filter) {
      xs = xs.filter((r) => classifyTier(r) === filter);
    } else if (!showIdle) {
      xs = xs.filter((r) => classifyTier(r) !== 'idle');
    }
    return xs;
  }, [sortedRows, filter, showIdle]);

  const editingRow = sortedRows.find((r) => r.id === editingId) ?? null;
  const closeDrawer = () => setEditingId(null);

  const showAttentionRail =
    tierCounts.critical > 0 ||
    tierCounts.warning > 0 ||
    tierCounts['no-budget-spend'] > 0 ||
    uncategorized > 0;

  return (
    <div className="pt-28 px-8 pb-12 overflow-y-auto h-full">
      <div className="flex gap-6 h-full">
        <div className="flex-1 min-w-0 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-headline font-extrabold text-on-surface">
                Budgets &amp; Kategorien
              </h1>
              <p className="text-xs text-on-surface-variant mt-1">
                {monthLabel} · {totalExpense > 0
                  ? `${Math.round(coverageRatio * 100)} % deiner Ausgaben durch Budgets abgedeckt`
                  : 'Noch keine Ausgaben in diesem Monat'}
              </p>
            </div>
            <div className="flex items-center gap-1 bg-surface-container-high rounded-lg p-1">
              <button
                onClick={() => setSelected((s) => shiftMonth(s.year, s.month, -1))}
                className="px-2 py-1 text-on-surface-variant hover:text-on-surface rounded-md transition-colors"
                aria-label="Vorheriger Monat"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setSelected({ year: now.getFullYear(), month: now.getMonth() + 1 })
                }
                disabled={isCurrentMonth}
                className="px-3 py-1 text-xs font-bold rounded-md transition-colors text-on-surface-variant hover:text-on-surface disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Heute
              </button>
              <button
                onClick={() => setSelected((s) => shiftMonth(s.year, s.month, 1))}
                disabled={isCurrentMonth}
                className="px-2 py-1 text-on-surface-variant hover:text-on-surface rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Nächster Monat"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <SummaryStrip
            totalExpense={totalExpense}
            totalBudgeted={totalBudgeted}
            spendInBudgeted={spendInBudgeted}
            remainingInBudgets={remainingInBudgets}
            spendOutsideBudgets={spendOutsideBudgets}
            coverageRatio={coverageRatio}
          />

          {showAttentionRail && (
            <AttentionRail
              counts={tierCounts}
              uncategorized={uncategorized}
              activeFilter={filter}
              onToggleFilter={(t) => setFilter((cur) => (cur === t ? null : t))}
            />
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h4 className="text-lg font-headline font-bold text-on-surface">
              {filter ? filterLabel(filter) : 'Alle Kategorien'}
              <span className="ml-2 text-xs font-medium text-on-surface-variant tabular-nums">
                {visibleRows.length}
              </span>
            </h4>
            {filter && (
              <button
                onClick={() => setFilter(null)}
                className="text-xs font-bold text-on-surface-variant hover:text-on-surface inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Filter aufheben
              </button>
            )}
          </div>

          {isPending ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white/5 animate-pulse rounded-2xl h-44" />
              ))}
            </div>
          ) : sortedRows.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant text-sm border border-dashed border-white/10 rounded-2xl">
              Noch keine Kategorien angelegt.
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant text-sm border border-dashed border-white/10 rounded-2xl">
              Keine Kategorien in dieser Auswahl.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {visibleRows.map((row) => (
                <CategoryCard
                  key={row.id}
                  row={row}
                  isSelected={editingId === row.id}
                  onEdit={() => setEditingId(row.id)}
                />
              ))}
            </div>
          )}

          {!filter && idleCount > 0 && (
            <div className="flex justify-center">
              <button
                onClick={() => setShowIdle((v) => !v)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface bg-surface-container/40 hover:bg-surface-container rounded-lg transition-colors"
              >
                {showIdle ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    {idleCount} Kategorien ohne Aktivität ausblenden
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    {idleCount} weitere Kategorien ohne Aktivität anzeigen
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {editingRow && (
            <BudgetDrawer
              row={editingRow}
              onClose={closeDrawer}
              onSave={(data) =>
                upsertBudget(data, {
                  onSuccess: closeDrawer,
                })
              }
              isSaving={isSaving}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function filterLabel(t: BudgetTier): string {
  switch (t) {
    case 'critical':
      return 'Über Budget';
    case 'warning':
      return 'Knapp am Limit';
    case 'no-budget-spend':
      return 'Ausgaben ohne Budget';
    case 'on-track':
      return 'Im Limit';
    case 'idle':
      return 'Ohne Aktivität';
  }
}

function SummaryStrip({
  totalExpense,
  totalBudgeted,
  spendInBudgeted,
  remainingInBudgets,
  spendOutsideBudgets,
  coverageRatio,
}: {
  totalExpense: number;
  totalBudgeted: number;
  spendInBudgeted: number;
  remainingInBudgets: number;
  spendOutsideBudgets: number;
  coverageRatio: number;
}) {
  const coveragePct = Math.round(coverageRatio * 100);
  return (
    <section className="bg-surface-container rounded-2xl p-8 border border-white/5">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-2">
            Ausgaben diesen Monat
          </p>
          <p className="text-3xl font-headline font-extrabold text-on-surface tabular-nums">
            {formatCurrency(totalExpense)}
          </p>
          <p className="text-[11px] text-on-surface-variant mt-1">
            Gesamt-Budget: {formatCurrency(totalBudgeted)}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-2">
            Frei in Budgets
          </p>
          <p
            className={`text-3xl font-headline font-extrabold tabular-nums ${
              remainingInBudgets >= 0 ? 'text-secondary' : 'text-error'
            }`}
            title="Verbleibendes Limit nur in Kategorien mit Budget"
          >
            {formatCurrency(remainingInBudgets)}
          </p>
          <p className="text-[11px] text-on-surface-variant mt-1">
            {formatCurrency(spendInBudgeted)} von {formatCurrency(totalBudgeted)} verbraucht
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-2">
            Außerhalb von Budgets
          </p>
          <p className="text-3xl font-headline font-extrabold tabular-nums text-on-surface">
            {formatCurrency(spendOutsideBudgets)}
          </p>
          <p className="text-[11px] text-on-surface-variant mt-1">
            Ausgaben ohne Budget &amp; nicht zugeordnet
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-2">
            Coverage
          </p>
          <p className="text-3xl font-headline font-extrabold tabular-nums text-primary">
            {coveragePct} %
          </p>
          <p className="text-[11px] text-on-surface-variant mt-1 tabular-nums">
            {formatCurrency(spendInBudgeted)} / {formatCurrency(totalExpense)}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden flex">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.min(100, coveragePct)}%` }}
            aria-label="Anteil mit Budget"
          />
          <div
            className="h-full bg-outline-variant/60 transition-all"
            style={{
              width: `${
                totalExpense > 0
                  ? Math.max(0, 100 - coveragePct)
                  : 0
              }%`,
            }}
            aria-label="Anteil ohne Budget"
          />
        </div>
      </div>
    </section>
  );
}

function AttentionRail({
  counts,
  uncategorized,
  activeFilter,
  onToggleFilter,
}: {
  counts: Record<BudgetTier, number>;
  uncategorized: number;
  activeFilter: BudgetTier | null;
  onToggleFilter: (t: BudgetTier) => void;
}) {
  const chips: Array<{
    key: BudgetTier;
    label: string;
    count: number;
    Icon: typeof AlertTriangle;
    tone: 'error' | 'gold' | 'outline';
  }> = [
    {
      key: 'critical',
      label: 'Über Budget',
      count: counts.critical,
      Icon: AlertTriangle,
      tone: 'error',
    },
    {
      key: 'warning',
      label: 'Knapp (>80 %)',
      count: counts.warning,
      Icon: TrendingUp,
      tone: 'gold',
    },
    {
      key: 'no-budget-spend',
      label: 'Ausgaben ohne Budget',
      count: counts['no-budget-spend'],
      Icon: Plus,
      tone: 'outline',
    },
  ];

  return (
    <section
      className="flex flex-wrap items-center gap-2"
      aria-label="Aufmerksamkeit benötigt"
    >
      {chips
        .filter((c) => c.count > 0)
        .map((c) => {
          const isActive = activeFilter === c.key;
          const baseTone =
            c.tone === 'error'
              ? 'border-error/40 bg-error/10 text-error'
              : c.tone === 'gold'
                ? 'border-secondary/40 bg-secondary/10 text-secondary'
                : 'border-outline-variant bg-surface-container text-on-surface';
          const activeTone =
            c.tone === 'error'
              ? 'border-error/80 bg-error/20'
              : c.tone === 'gold'
                ? 'border-secondary/80 bg-secondary/20'
                : 'border-outline bg-surface-container-high';
          return (
            <button
              key={c.key}
              onClick={() => onToggleFilter(c.key)}
              className={`inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border transition-colors ${baseTone} ${
                isActive ? activeTone : ''
              }`}
              aria-pressed={isActive}
            >
              <c.Icon className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{c.label}</span>
              <span className="text-[11px] font-extrabold tabular-nums bg-black/30 rounded-full px-2 py-0.5">
                {c.count}
              </span>
            </button>
          );
        })}

      {uncategorized > 0 && (
        <Link
          to="/transactions"
          className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border border-outline-variant bg-surface-container text-on-surface hover:border-outline transition-colors"
          title="Ausgaben ohne Kategorie — in den Transaktionen zuordnen"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span className="text-xs font-bold">Unkategorisiert</span>
          <span className="text-[11px] font-extrabold tabular-nums bg-black/30 rounded-full px-2 py-0.5">
            {formatCurrency(uncategorized)}
          </span>
        </Link>
      )}
    </section>
  );
}

type CategoryCardProps = {
  row: BudgetRow;
  isSelected: boolean;
  onEdit: () => void;
  key?: string;
};

function CategoryCard({ row, isSelected, onEdit }: CategoryCardProps) {
  const limit = row.budget?.monthly_limit ?? 0;
  const pct = limit > 0 ? (row.spent / limit) * 100 : 0;
  const tier = classifyTier(row);

  let barClass = 'bg-primary';
  let statusLabel = limit > 0 ? `${formatCurrency(limit - row.spent)} übrig` : '';
  let statusColor = 'text-on-surface-variant';
  if (tier === 'critical') {
    barClass = 'bg-error';
    statusLabel = `${formatCurrency(row.spent - limit)} über Limit`;
    statusColor = 'text-error';
  } else if (tier === 'warning') {
    barClass = 'bg-secondary';
    statusLabel = 'Knapp am Limit';
    statusColor = 'text-secondary';
  }

  const accent =
    tier === 'critical'
      ? 'border-l-error'
      : tier === 'warning'
        ? 'border-l-secondary'
        : tier === 'no-budget-spend'
          ? 'border-l-outline-variant'
          : tier === 'on-track'
            ? 'border-l-primary/60'
            : 'border-l-transparent';

  const idle = tier === 'idle';

  return (
    <motion.div
      layout
      className={`bg-surface-container rounded-2xl p-6 border border-white/5 border-l-4 ${accent} hover:border-primary/20 transition-all ${
        isSelected ? 'ring-2 ring-primary/60' : ''
      } ${idle ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
            <TagIcon className="w-5 h-5" />
          </div>
          {tier === 'no-budget-spend' && (
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full bg-outline-variant/30 text-on-surface-variant">
              Kein Budget
            </span>
          )}
          {tier === 'critical' && (
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full bg-error/20 text-error">
              Über Limit
            </span>
          )}
          {tier === 'warning' && (
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full bg-secondary/20 text-secondary">
              Knapp
            </span>
          )}
        </div>
        <button
          onClick={onEdit}
          className="p-2 text-on-surface-variant hover:text-primary transition-colors"
          aria-label={row.budget ? 'Budget bearbeiten' : 'Budget setzen'}
        >
          {row.budget ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      <Link
        to={`/transactions?category_id=${row.id}`}
        className="block mb-4 hover:opacity-80 transition-opacity"
      >
        <h5 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1">
          {row.name}
        </h5>
        <div className="flex items-baseline gap-1">
          <span
            className={`text-2xl font-headline font-bold tabular-nums ${
              tier === 'critical' ? 'text-error' : 'text-on-surface'
            }`}
          >
            {formatCurrency(row.spent)}
          </span>
          {limit > 0 && (
            <span className="text-xs text-on-surface-variant tabular-nums">
              / {formatCurrency(limit)}
            </span>
          )}
        </div>
        <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-tighter mt-1">
          {row.txCount} Transaktion{row.txCount === 1 ? '' : 'en'}
        </p>
      </Link>

      {row.refunded && row.refunded > 0 ? (
        <div className="mb-3 -mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-400/10 border border-amber-400/30 text-[11px] font-bold text-amber-300 tabular-nums"
             title={`Brutto ${formatCurrency(row.spentGross ?? row.spent + row.refunded)} ausgegeben, davon ${formatCurrency(row.refunded)} erstattet — Netto ${formatCurrency(row.spent)}.`}>
          ↻ {formatCurrency(row.refunded)} erstattet
          <span className="text-on-surface-variant/70 font-normal">
            · brutto {formatCurrency(row.spentGross ?? row.spent + row.refunded)}
          </span>
        </div>
      ) : null}

      {limit > 0 && (
        <div className="space-y-2">
          <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className={`h-full ${barClass} rounded-full transition-all`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className={`flex justify-between text-[10px] font-bold ${statusColor}`}>
            <span>{Math.round(pct)} %</span>
            <span>{statusLabel}</span>
          </div>
        </div>
      )}

      {tier === 'no-budget-spend' && (
        <button
          onClick={onEdit}
          className="mt-2 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary/40 text-[11px] font-bold uppercase tracking-wider transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Limit setzen
        </button>
      )}

      {tier === 'idle' && (
        <p className="text-[10px] text-on-surface-variant/60 italic">
          Keine Aktivität in diesem Monat
        </p>
      )}
    </motion.div>
  );
}

function BudgetDrawer({
  row,
  onClose,
  onSave,
  isSaving,
}: {
  row: BudgetRow;
  onClose: () => void;
  onSave: (data: BudgetFormData) => void;
  isSaving: boolean;
}) {
  const limit = row.budget?.monthly_limit ?? 0;
  const tier = classifyTier(row);
  const pct = limit > 0 ? (row.spent / limit) * 100 : 0;

  const { register, handleSubmit, formState } = useForm<
    BudgetFormInput,
    unknown,
    BudgetFormData
  >({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      category_id: row.id,
      monthly_limit: row.budget?.monthly_limit ?? 0,
      currency: row.budget?.currency ?? 'EUR',
    },
  });

  return (
    <motion.aside
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed lg:sticky right-4 lg:right-auto top-24 lg:top-28 z-30 w-[calc(100vw-2rem)] sm:w-96 lg:shrink-0 bg-surface-container border border-white/5 rounded-2xl p-6 flex flex-col shadow-2xl overflow-y-auto self-start max-h-[calc(100vh-8rem)]"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface">
          {row.budget ? 'Budget bearbeiten' : 'Budget setzen'}
        </h3>
        <button
          onClick={onClose}
          className="text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label="Schließen"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="mb-6 p-4 bg-surface-container-lowest rounded-xl border border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
            <TagIcon className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-base font-headline font-extrabold text-on-surface leading-tight">
              {row.name}
            </h4>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
              {row.txCount} Transaktion{row.txCount === 1 ? '' : 'en'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
              Ausgegeben
            </p>
            <p
              className={`text-lg font-headline font-extrabold tabular-nums ${
                tier === 'critical' ? 'text-error' : 'text-on-surface'
              }`}
            >
              {formatCurrency(row.spent)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
              Limit
            </p>
            <p className="text-lg font-headline font-extrabold tabular-nums text-on-surface">
              {limit > 0 ? formatCurrency(limit) : '— —'}
            </p>
          </div>
        </div>
        {limit > 0 && (
          <div className="mt-3 h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                tier === 'critical'
                  ? 'bg-error'
                  : tier === 'warning'
                    ? 'bg-secondary'
                    : 'bg-primary'
              }`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit(onSave)}
        className="space-y-4 flex-1 flex flex-col"
      >
        <input type="hidden" {...register('category_id')} />
        <input type="hidden" {...register('currency')} />
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Limit pro Monat (€)
          </label>
          <input
            {...register('monthly_limit')}
            type="number"
            step="0.01"
            autoFocus
            placeholder="z. B. 500"
            className="w-full bg-surface-container-lowest border border-white/5 rounded-lg text-sm text-on-surface p-2.5 focus:ring-2 focus:ring-primary outline-none tabular-nums"
          />
          {formState.errors.monthly_limit && (
            <p className="text-[10px] text-error font-bold">
              {formState.errors.monthly_limit.message as string}
            </p>
          )}
          <p className="text-[10px] text-on-surface-variant flex items-start gap-1">
            <CircleHelp className="w-3 h-3 mt-px shrink-0" />
            <span>
              Wird gold ab 80&nbsp;% und rot ab 100&nbsp;% des Limits.
            </span>
          </p>
        </div>

        <div className="pt-6 border-t border-white/5 space-y-2 mt-auto">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-primary text-on-primary font-bold py-3 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
          >
            {isSaving ? 'Speichern…' : 'Speichern'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-transparent border border-white/10 hover:bg-surface-container-high text-on-surface-variant font-bold py-3 rounded-lg transition-all"
          >
            Abbrechen
          </button>
          <Link
            to={`/transactions?category_id=${row.id}`}
            className="block text-center text-[11px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary pt-2"
          >
            Transaktionen ansehen →
          </Link>
        </div>
      </form>

      <div className="mt-4 flex items-center justify-center text-[10px] text-on-surface-variant">
        <Wallet className="w-3 h-3 mr-1" />
        Limit gilt monatlich, jeden Monat zurückgesetzt.
      </div>
    </motion.aside>
  );
}
