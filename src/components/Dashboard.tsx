import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import { useMonthlySummary, useCashflow } from '../api/aggregates';
import { useTransactions } from '../api/transactions';
import { useReports } from '../api/reports';
import { formatCurrency, formatDate } from '../lib/format';
import type { CashflowPoint } from '../api/types';

type Range = 3 | 6 | 12;

const MONTH_SHORT_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function buildChartPaths(series: CashflowPoint[], width = 800, height = 200) {
  if (series.length < 2) return null;
  const values = series.map((s) => s.net);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const stepX = width / (series.length - 1);
  const points = series.map((s, i) => ({
    x: i * stepX,
    y: height - ((s.net - min) / range) * (height * 0.85) - height * 0.075,
  }));
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const area = `${line} L${width.toFixed(1)},${height.toFixed(1)} L0,${height.toFixed(1)} Z`;
  return { line, area, points };
}

export default function Dashboard() {
  const [range, setRange] = useState<Range>(6);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: summary, isPending: isSummaryPending } = useMonthlySummary(year, month);
  const { data: cashflow } = useCashflow(range);
  const { data: txs, isPending: isTxsPending } = useTransactions({ limit: 5 });
  const { data: reports } = useReports({ limit: 1 });

  const latestReport = reports?.items?.[0];
  const saldoPositive = (summary?.net ?? 0) >= 0;

  const chart = cashflow?.series ? buildChartPaths(cashflow.series) : null;

  const kpis = [
    {
      label: 'Einnahmen',
      value: summary ? formatCurrency(summary.income) : '—',
      hint: summary ? `${summary.transaction_count} Transaktionen` : '',
      icon: ArrowUpRight,
      tone: 'primary' as const,
    },
    {
      label: 'Ausgaben',
      value: summary ? formatCurrency(summary.expenses) : '—',
      hint: summary ? `Sparquote ${(summary.savings_rate * 100).toFixed(1).replace('.', ',')} %` : '',
      icon: ArrowDownRight,
      tone: 'neutral' as const,
    },
    {
      label: 'Saldo',
      value: summary ? formatCurrency(summary.net) : '—',
      hint: saldoPositive ? 'Positiv' : 'Negativ',
      icon: Wallet,
      tone: saldoPositive ? ('gold' as const) : ('danger' as const),
    },
  ];

  return (
    <div className="pt-28 px-8 pb-12 overflow-y-auto h-full space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          const borderClass =
            kpi.tone === 'gold'
              ? 'border-secondary/50'
              : kpi.tone === 'danger'
              ? 'border-error/50'
              : 'border-white/5';
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`bg-surface-container p-6 rounded-xl border-2 ${borderClass} relative overflow-hidden`}
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  {kpi.label}
                </span>
                <Icon
                  className={`w-5 h-5 ${
                    kpi.tone === 'gold'
                      ? 'text-secondary'
                      : kpi.tone === 'danger'
                      ? 'text-error'
                      : 'text-primary'
                  }`}
                />
              </div>
              {isSummaryPending ? (
                <div className="h-9 w-32 bg-white/5 animate-pulse rounded-lg" />
              ) : (
                <h2 className="text-3xl font-headline font-extrabold text-on-surface tabular-nums">
                  {kpi.value}
                </h2>
              )}
              <p className="text-xs mt-2 text-on-surface-variant font-medium">{kpi.hint}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-surface-container-low p-8 rounded-2xl border border-white/5"
          >
            <div className="flex justify-between items-end mb-8">
              <div>
                <h3 className="text-xl font-headline font-bold text-on-surface">Cashflow</h3>
                <p className="text-sm text-on-surface-variant">Netto pro Monat</p>
              </div>
              <div className="flex gap-1 bg-surface-container-high rounded-lg p-1">
                {([3, 6, 12] as Range[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                      r === range
                        ? 'bg-primary text-on-primary'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {r}M
                  </button>
                ))}
              </div>
            </div>

            <div className="relative h-64 w-full">
              {chart ? (
                <svg
                  className="w-full h-full"
                  viewBox="0 0 800 200"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#44d8f1" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#44d8f1" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={chart.area} fill="url(#chartFill)" />
                  <path
                    d={chart.line}
                    fill="none"
                    stroke="#44d8f1"
                    strokeLinecap="round"
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5 rounded-xl border border-dashed border-white/10">
                  <p className="text-xs text-on-surface-variant font-medium">
                    Keine Cashflow-Daten im Zeitraum
                  </p>
                </div>
              )}
            </div>

            {cashflow?.series && cashflow.series.length > 0 && (
              <div className="grid grid-cols-6 mt-6 text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                {cashflow.series.slice(-6).map((p) => (
                  <span key={`${p.year}-${p.month}`} className="text-center">
                    {MONTH_SHORT_DE[p.month - 1]} {String(p.year).slice(-2)}
                  </span>
                ))}
              </div>
            )}
          </motion.div>

          {latestReport && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-container border-2 border-primary/30 p-6 rounded-2xl"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="text-lg font-headline font-bold text-on-surface">
                    Neuester AI-Report
                  </h4>
                  <p className="text-xs text-primary font-bold uppercase tracking-widest">
                    {formatDate(latestReport.created_at, 'dd.MM.yyyy')}
                  </p>
                </div>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                {latestReport.title}
              </p>
              <Link
                to="/reports"
                className="inline-block bg-primary text-on-primary text-xs font-bold py-2.5 px-6 rounded-lg hover:brightness-110 transition-all"
              >
                Öffnen
              </Link>
            </motion.div>
          )}
        </div>

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-surface-container-high p-6 rounded-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline font-bold text-on-surface">Letzte Transaktionen</h3>
              <Link
                to="/transactions"
                className="text-xs text-primary font-bold uppercase tracking-wider hover:underline"
              >
                Alle
              </Link>
            </div>
            <div className="space-y-1">
              {isTxsPending ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-16 w-full bg-white/5 animate-pulse rounded-xl mb-2"
                  />
                ))
              ) : txs?.items.length === 0 ? (
                <p className="text-xs text-on-surface-variant text-center py-8">
                  Noch keine Transaktionen
                </p>
              ) : (
                txs?.items.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-4 border-b border-white/5 last:border-0 px-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          tx.amount < 0 ? 'bg-error' : 'bg-primary'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate max-w-[140px]">
                          {tx.recipient || tx.sender || tx.description || 'Unbekannt'}
                        </p>
                        <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-tighter">
                          {tx.category?.name || 'Unkategorisiert'} ·{' '}
                          {formatDate(tx.booking_date, 'dd.MM.')}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`text-sm font-headline font-extrabold tabular-nums shrink-0 ml-2 ${
                        tx.amount < 0 ? 'text-on-surface' : 'text-primary'
                      }`}
                    >
                      {tx.amount > 0 ? '+' : ''}
                      {formatCurrency(tx.amount)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {summary && summary.by_category.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-container-high p-6 rounded-2xl"
            >
              <h3 className="font-headline font-bold text-on-surface mb-6 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Top Kategorien
              </h3>
              <div className="space-y-4">
                {summary.by_category.slice(0, 5).map((c, i) => {
                  const maxTotal = Math.max(
                    ...summary.by_category.map((x) => Math.abs(x.total)),
                  );
                  const pct = maxTotal > 0 ? (Math.abs(c.total) / maxTotal) * 100 : 0;
                  return (
                    <div key={c.category_id}>
                      <div className="flex justify-between text-[11px] font-bold text-on-surface-variant mb-2">
                        <span className="truncate pr-2">{c.category_name}</span>
                        <span className="tabular-nums shrink-0">
                          {formatCurrency(Math.abs(c.total))}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: 0.1 * i }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
