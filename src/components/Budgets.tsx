import { Edit3, Plus, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useBudgets, useCategories, useUpsertBudget } from '../api/categories';
import { useMonthlySummary } from '../api/aggregates';
import { formatCurrency } from '../lib/format';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const budgetSchema = z.object({
  category_id: z.string().min(1, 'Kategorie erforderlich'),
  monthly_limit: z.coerce.number().min(1, 'Limit muss positiv sein'),
  currency: z.string().default('EUR'),
});

type BudgetFormData = z.infer<typeof budgetSchema>;
type BudgetFormInput = z.input<typeof budgetSchema>;

export default function Budgets() {
  const [editingId, setEditingId] = useState<string | null>(null);

  const now = new Date();
  const { data: summary } = useMonthlySummary(now.getFullYear(), now.getMonth() + 1);
  const { data: budgets, isPending } = useBudgets();
  const { data: categories } = useCategories();
  const { mutate: upsertBudget, isPending: isSaving } = useUpsertBudget();

  const { register, handleSubmit, reset } = useForm<BudgetFormInput, unknown, BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { currency: 'EUR' },
  });

  const onSave = (data: BudgetFormData) => {
    upsertBudget(data, {
      onSuccess: () => {
        setEditingId(null);
        reset();
      },
    });
  };

  const globalSpent = Math.abs(summary?.expenses ?? 0);
  const globalLimit = budgets?.reduce((acc, b) => acc + b.monthly_limit, 0) || 0;
  const remaining = globalLimit - globalSpent;

  return (
    <div className="pt-24 px-8 pb-12 overflow-y-auto h-full space-y-8">
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface-container rounded-2xl p-8 border border-white/5">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-2">
            Gesamt-Budget (monatlich)
          </p>
          <h3 className="text-5xl font-headline font-extrabold text-on-surface tabular-nums">
            {formatCurrency(globalLimit)}
          </h3>
          <div className="mt-8 grid grid-cols-2 gap-8">
            <div>
              <p className="text-xs text-on-surface-variant mb-1">Bereits ausgegeben</p>
              <p className="text-2xl font-headline font-bold text-primary tabular-nums">
                {formatCurrency(globalSpent)}
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
                Kategorien
              </p>
              <p className="text-sm text-on-surface font-medium">
                {budgets?.length ?? 0} aktive Budgets
              </p>
            </div>
          </div>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Setze monatliche Limits pro Kategorie. Die Balken färben sich gold bei &gt;80 % und rot bei &gt;100 %.
          </p>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <h4 className="text-lg font-headline font-bold text-on-surface">Budget-Kategorien</h4>
        <button
          onClick={() => {
            setEditingId('new');
            reset({ currency: 'EUR' });
          }}
          className="px-4 py-2 bg-primary/10 text-primary text-xs font-bold rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Neu
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {editingId === 'new' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-surface-container-highest rounded-2xl p-6 border-2 border-primary"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary text-on-primary flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <span className="px-2 py-1 bg-primary/20 text-primary text-[10px] font-black rounded uppercase tracking-widest">
                  Neu
                </span>
              </div>
              <form onSubmit={handleSubmit(onSave)} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">
                    Kategorie
                  </label>
                  <select
                    {...register('category_id')}
                    className="w-full bg-surface-container-lowest border border-white/5 rounded-lg text-sm text-on-surface p-2.5 focus:ring-2 focus:ring-primary outline-none"
                  >
                    <option value="">Kategorie wählen</option>
                    {categories?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">
                    Monatliches Limit (€)
                  </label>
                  <input
                    {...register('monthly_limit')}
                    type="number"
                    step="0.01"
                    placeholder="z.B. 500"
                    className="w-full bg-surface-container-lowest border border-white/5 rounded-lg text-sm text-on-surface p-2.5 focus:ring-2 focus:ring-primary outline-none tabular-nums"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-primary text-on-primary text-xs font-bold py-2.5 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {isSaving ? 'Speichern...' : 'Speichern'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="px-4 border border-white/10 text-on-surface-variant text-xs font-bold py-2.5 rounded-lg hover:bg-surface-container transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {isPending ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white/5 animate-pulse rounded-2xl h-48" />
          ))
        ) : budgets?.length === 0 ? (
          <div className="col-span-full text-center py-16 text-on-surface-variant text-sm border border-dashed border-white/10 rounded-2xl">
            Noch keine Budgets konfiguriert. Klick auf „Neu".
          </div>
        ) : (
          budgets?.map((b) => {
            const breakdown = summary?.by_category?.find(
              (s) => s.category_id === b.category_id,
            );
            const spent = breakdown ? Math.abs(breakdown.total) : 0;
            const limit = b.monthly_limit;
            const pct = limit > 0 ? (spent / limit) * 100 : 0;

            let barClass = 'bg-primary';
            let statusLabel = `${formatCurrency(limit - spent)} übrig`;
            let statusColor = 'text-on-surface-variant';
            if (pct > 100) {
              barClass = 'bg-error';
              statusLabel = `${formatCurrency(spent - limit)} über Limit`;
              statusColor = 'text-error';
            } else if (pct > 80) {
              barClass = 'bg-secondary';
              statusLabel = 'Warnung';
              statusColor = 'text-secondary';
            }

            return (
              <div
                key={b.category_id}
                className="bg-surface-container rounded-2xl p-6 border border-white/5 hover:border-primary/20 transition-all"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <button className="p-2 text-on-surface-variant hover:text-primary transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
                <div className="mb-4">
                  <h5 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                    {b.category?.name ?? 'Unbekannt'}
                  </h5>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`text-2xl font-headline font-bold tabular-nums ${
                        pct > 100 ? 'text-error' : 'text-on-surface'
                      }`}
                    >
                      {formatCurrency(spent)}
                    </span>
                    <span className="text-xs text-on-surface-variant tabular-nums">
                      / {formatCurrency(limit)}
                    </span>
                  </div>
                </div>
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
