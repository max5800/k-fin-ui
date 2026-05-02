import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
  Tag as TagIcon,
  Wallet,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useBudgets,
  useCategories,
  useUpsertBudget,
} from '../api/categories';
import { useMonthlySummary } from '../api/aggregates';
import { formatCurrency } from '../lib/format';
import type { Budget, CategoryBreakdown } from '../api/types';

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

type Row = {
  id: string;
  name: string;
  type: string;
  spent: number;
  txCount: number;
  budget: Budget | null;
};

export default function Categories() {
  const now = new Date();
  const [selected, setSelected] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: summary } = useMonthlySummary(selected.year, selected.month);
  const { data: categories, isPending } = useCategories();
  const { data: budgets } = useBudgets();
  const { mutate: upsertBudget, isPending: isSaving } = useUpsertBudget();

  const monthLabel = `${MONTH_LONG_DE[selected.month - 1]} ${selected.year}`;
  const isCurrentMonth =
    selected.year === now.getFullYear() && selected.month === now.getMonth() + 1;

  // Build one row per category. Categories without spending in this month get spent=0.
  // Categories with no budget get budget=null.
  const rows = useMemo<Row[]>(() => {
    if (!categories) return [];
    const breakdownByCat = new Map<string, CategoryBreakdown>();
    for (const c of summary?.by_category ?? []) {
      breakdownByCat.set(c.category_id, c);
    }
    const budgetByCat = new Map<string, Budget>();
    for (const b of budgets ?? []) {
      budgetByCat.set(b.category_id, b);
    }
    return categories
      .map<Row>((c) => {
        const b = breakdownByCat.get(c.id);
        return {
          id: c.id,
          name: c.name,
          type: c.type,
          spent: b ? Math.abs(b.total) : 0,
          txCount: b?.transaction_count ?? 0,
          budget: budgetByCat.get(c.id) ?? null,
        };
      })
      .sort((a, b) => b.spent - a.spent);
  }, [categories, summary, budgets]);

  const totalSpentThisMonth = Math.abs(summary?.expenses ?? 0);
  const totalBudgeted = (budgets ?? []).reduce((acc, b) => acc + b.monthly_limit, 0);
  const remaining = totalBudgeted - totalSpentThisMonth;

  return (
    <div className="pt-28 px-8 pb-12 overflow-y-auto h-full space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-extrabold text-on-surface">
            Kategorien
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Ist-Werte für {monthLabel} · Budgets als monatliches Soll-Limit
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

      {totalBudgeted > 0 && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface-container rounded-2xl p-8 border border-white/5">
            <p className="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-2">
              Gesamt-Budget (monatlich)
            </p>
            <h3 className="text-5xl font-headline font-extrabold text-on-surface tabular-nums">
              {formatCurrency(totalBudgeted)}
            </h3>
            <div className="mt-8 grid grid-cols-2 gap-8">
              <div>
                <p className="text-xs text-on-surface-variant mb-1">Bereits ausgegeben</p>
                <p className="text-2xl font-headline font-bold text-primary tabular-nums">
                  {formatCurrency(totalSpentThisMonth)}
                </p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant mb-1">Verbleibend</p>
                <p
                  className={`text-2xl font-headline font-bold tabular-nums ${
                    remaining >= 0 ? 'text-secondary' : 'text-error'
                  }`}
                >
                  {formatCurrency(remaining)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-high rounded-2xl p-8 border border-white/5 flex flex-col justify-center">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-primary uppercase tracking-tight">
                  Aktive Budgets
                </p>
                <p className="text-sm text-on-surface font-medium">
                  {budgets?.length ?? 0} von {categories?.length ?? 0} Kategorien
                </p>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Setze monatliche Limits pro Kategorie. Die Balken färben sich gold bei &gt;80&nbsp;% und rot bei &gt;100&nbsp;%.
            </p>
          </div>
        </section>
      )}

      <div className="flex items-center justify-between">
        <h4 className="text-lg font-headline font-bold text-on-surface">
          Alle Kategorien
        </h4>
      </div>

      {isPending ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white/5 animate-pulse rounded-2xl h-44" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant text-sm border border-dashed border-white/10 rounded-2xl">
          Noch keine Kategorien angelegt.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {rows.map((row) => (
            <CategoryCard
              key={row.id}
              row={row}
              isEditing={editingId === row.id}
              onEdit={() => setEditingId(row.id)}
              onCancel={() => setEditingId(null)}
              onSave={(data) =>
                upsertBudget(data, {
                  onSuccess: () => setEditingId(null),
                })
              }
              isSaving={isSaving}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type CategoryCardProps = {
  row: Row;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (data: BudgetFormData) => void;
  isSaving: boolean;
  key?: string;
};

function CategoryCard({
  row,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  isSaving,
}: CategoryCardProps) {
  const limit = row.budget?.monthly_limit ?? 0;
  const pct = limit > 0 ? (row.spent / limit) * 100 : 0;

  let barClass = 'bg-primary';
  let statusLabel = limit > 0 ? `${formatCurrency(limit - row.spent)} übrig` : '';
  let statusColor = 'text-on-surface-variant';
  if (limit > 0 && pct > 100) {
    barClass = 'bg-error';
    statusLabel = `${formatCurrency(row.spent - limit)} über Limit`;
    statusColor = 'text-error';
  } else if (limit > 0 && pct > 80) {
    barClass = 'bg-secondary';
    statusLabel = 'Warnung';
    statusColor = 'text-secondary';
  }

  return (
    <motion.div
      layout
      className="bg-surface-container rounded-2xl p-6 border border-white/5 hover:border-primary/20 transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
          <TagIcon className="w-5 h-5" />
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
              limit > 0 && pct > 100 ? 'text-error' : 'text-on-surface'
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

      <AnimatePresence>
        {isEditing && (
          <BudgetForm
            row={row}
            onCancel={onCancel}
            onSave={onSave}
            isSaving={isSaving}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function BudgetForm({
  row,
  onCancel,
  onSave,
  isSaving,
}: {
  row: Row;
  onCancel: () => void;
  onSave: (data: BudgetFormData) => void;
  isSaving: boolean;
}) {
  const { register, handleSubmit } = useForm<BudgetFormInput, unknown, BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      category_id: row.id,
      monthly_limit: row.budget?.monthly_limit ?? 0,
      currency: row.budget?.currency ?? 'EUR',
    },
  });

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={handleSubmit(onSave)}
      className="mt-4 pt-4 border-t border-white/5 space-y-3"
    >
      <input type="hidden" {...register('category_id')} />
      <input type="hidden" {...register('currency')} />
      <div>
        <label className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">
          Monatliches Limit (€)
        </label>
        <input
          {...register('monthly_limit')}
          type="number"
          step="0.01"
          autoFocus
          placeholder="z. B. 500"
          className="w-full bg-surface-container-lowest border border-white/5 rounded-lg text-sm text-on-surface p-2.5 focus:ring-2 focus:ring-primary outline-none tabular-nums"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 bg-primary text-on-primary text-xs font-bold py-2.5 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
        >
          {isSaving ? 'Speichern…' : 'Speichern'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 border border-white/10 text-on-surface-variant text-xs font-bold py-2.5 rounded-lg hover:bg-surface-container transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </motion.form>
  );
}
