import { useMemo, useState, type ComponentType } from 'react';
import { motion } from 'motion/react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  LineChart,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import {
  useAllPositions,
  useDepots,
  usePortfolioAllocation,
  usePortfolioPerformance,
  usePortfolioSummary,
} from '../api/portfolio';
import { formatCurrency } from '../lib/format';
import type { Depot, PerformancePoint, PerformanceRange, Position } from '../api/types';

const ALL_DEPOTS = 'all' as const;
type DepotSelection = typeof ALL_DEPOTS | string;

const RANGES: PerformanceRange[] = ['1D', '1W', '1M', '1Y', 'MAX'];

const ALLOCATION_COLORS = ['#44d8f1', '#00bcd4', '#f4bd5f', '#869396', '#a1efff'];

function formatPercent(value: number, digits = 1): string {
  const abs = value.toFixed(digits).replace('.', ',');
  return `${abs} %`;
}

function buildChartPaths(series: PerformancePoint[], width = 800, height = 200) {
  if (series.length < 2) return null;
  const values = series.map((p) => p.total_value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (series.length - 1);
  const points = series.map((p, i) => ({
    x: i * stepX,
    y: height - ((p.total_value - min) / range) * (height * 0.85) - height * 0.075,
  }));
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const area = `${line} L${width.toFixed(1)},${height.toFixed(1)} L0,${height.toFixed(1)} Z`;
  return { line, area };
}

export default function Portfolio() {
  const [range, setRange] = useState<PerformanceRange>('1Y');
  const [selectedDepot, setSelectedDepot] = useState<DepotSelection>(ALL_DEPOTS);

  const { data: summary, isPending: isSummaryPending } = usePortfolioSummary();
  const { data: allocation } = usePortfolioAllocation();
  const { data: performance } = usePortfolioPerformance(range);
  const { data: depots } = useDepots();

  const { byDepotId, isPending: isPositionsPending } = useAllPositions(depots);

  const visiblePositions = useMemo(
    () => selectPositions(depots, byDepotId, selectedDepot),
    [depots, byDepotId, selectedDepot],
  );

  const chart = useMemo(
    () => (performance ? buildChartPaths(performance) : null),
    [performance],
  );

  const dailyPositive = (summary?.daily_pnl_abs ?? 0) >= 0;
  const totalPositive = (summary?.total_pnl_abs ?? 0) >= 0;

  return (
    <div className="pt-28 px-8 pb-12 overflow-y-auto h-full space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <KpiCard
          label="Gesamtwert"
          value={summary ? formatCurrency(summary.total_value) : '—'}
          hint={summary ? `${summary.positions_count} Positionen` : ''}
          icon={Wallet}
          tone="neutral"
          pending={isSummaryPending}
        />
        <KpiCard
          label="G/V Heute"
          value={summary ? formatCurrency(summary.daily_pnl_abs) : '—'}
          hint={summary ? formatPercent(summary.daily_pnl_rel, 2) : ''}
          icon={dailyPositive ? ArrowUpRight : ArrowDownRight}
          tone={dailyPositive ? 'primary' : 'danger'}
          pending={isSummaryPending}
        />
        <KpiCard
          label="G/V Gesamt"
          value={summary ? formatCurrency(summary.total_pnl_abs) : '—'}
          hint={summary ? formatPercent(summary.total_pnl_rel, 1) : ''}
          icon={LineChart}
          tone={totalPositive ? 'primary' : 'danger'}
          pending={isSummaryPending}
        />
        <KpiCard
          label="Dividendenrendite"
          value={summary ? formatPercent(summary.dividend_yield_pct, 2) : '—'}
          hint="Letzte 12 Monate"
          icon={BadgeDollarSign}
          tone="gold"
          pending={isSummaryPending}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="xl:col-span-2 bg-surface-container-low p-8 rounded-2xl border border-white/5"
        >
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-headline font-bold text-on-surface">Performance</h3>
              <p className="text-sm text-on-surface-variant">Depotwert im Zeitverlauf</p>
            </div>
            <div className="flex gap-1 bg-surface-container-high rounded-lg p-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    r === range
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="relative h-64 w-full">
            {chart ? (
              <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="portfolioChartFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#44d8f1" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#44d8f1" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={chart.area} fill="url(#portfolioChartFill)" />
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
              <div className="w-full h-full flex items-center justify-center bg-white/5 rounded-xl border border-dashed border-white/10 text-center px-8">
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                  Noch keine Historie — Depot-Snapshots werden ab dem nächsten Sync täglich
                  festgehalten.
                </p>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-surface-container-low p-8 rounded-2xl border border-white/5"
        >
          <h3 className="text-xl font-headline font-bold text-on-surface mb-6">
            Asset Allocation
          </h3>
          {allocation && allocation.length > 0 ? (
            <div className="space-y-5">
              {allocation.map((bucket, i) => (
                <div key={bucket.bucket}>
                  <div className="flex justify-between items-end mb-2">
                    <span className="font-medium text-on-surface">{bucket.bucket}</span>
                    <span className="font-headline font-semibold tabular-nums">
                      {formatPercent(bucket.share_pct, 1)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${bucket.share_pct}%` }}
                      transition={{ duration: 0.6, delay: 0.1 * i }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant py-8 text-center">
              Keine Positionen im Depot.
            </p>
          )}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface-container-low rounded-2xl border border-white/5 overflow-hidden"
      >
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <div>
            <h3 className="font-headline font-bold text-on-surface text-xl">Bestandsliste</h3>
            <p className="text-xs text-on-surface-variant">
              {bestandslisteSubtitle(depots, selectedDepot)}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-primary font-bold uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" />
            {visiblePositions.length} Positionen
          </div>
        </div>
        {depots && depots.length > 1 && (
          <DepotTabs
            depots={depots}
            selected={selectedDepot}
            onSelect={setSelectedDepot}
          />
        )}
        <PositionsTable positions={visiblePositions} isPending={isPositionsPending} />
      </motion.div>
    </div>
  );
}

type KpiCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone: 'primary' | 'danger' | 'gold' | 'neutral';
  pending: boolean;
};

function KpiCard({ label, value, hint, icon: Icon, tone, pending }: KpiCardProps) {
  const borderClass =
    tone === 'primary'
      ? 'border-primary/40'
      : tone === 'danger'
      ? 'border-error/50'
      : tone === 'gold'
      ? 'border-secondary/50'
      : 'border-white/5';
  const iconClass =
    tone === 'primary'
      ? 'text-primary'
      : tone === 'danger'
      ? 'text-error'
      : tone === 'gold'
      ? 'text-secondary'
      : 'text-primary';
  const valueClass =
    tone === 'primary'
      ? 'text-primary'
      : tone === 'danger'
      ? 'text-error'
      : tone === 'gold'
      ? 'text-secondary'
      : 'text-on-surface';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-surface-container p-6 rounded-xl border-2 ${borderClass} relative overflow-hidden`}
    >
      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
        <Icon className={`w-5 h-5 ${iconClass}`} />
      </div>
      {pending ? (
        <div className="h-9 w-32 bg-white/5 animate-pulse rounded-lg" />
      ) : (
        <h2 className={`text-3xl font-headline font-extrabold tabular-nums ${valueClass}`}>
          {value}
        </h2>
      )}
      <p className="text-xs mt-2 text-on-surface-variant font-medium">{hint}</p>
    </motion.div>
  );
}

function PositionsTable({
  positions,
  isPending,
}: {
  positions: Position[];
  isPending: boolean;
}) {
  if (isPending) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 w-full bg-white/5 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }
  if (positions.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant text-center py-12">
        Keine Positionen geladen. Nach dem ersten Sync erscheinen die Bestände hier.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white/5">
            <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Name / ISIN
            </th>
            <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">
              Kurs
            </th>
            <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">
              Perf. (24h)
            </th>
            <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">
              Perf. (Gesamt)
            </th>
            <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">
              Marktwert
            </th>
            <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">
              Gewichtung
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {positions.map((p) => (
            <tr key={`${p.depot_id}:${p.instrument.isin}`} className="hover:bg-white/5 transition-colors">
              <td className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center border border-white/10 text-on-surface font-bold text-xs">
                    {p.instrument.wkn || p.instrument.isin.slice(0, 4)}
                  </div>
                  <div>
                    <p className="font-medium text-on-surface">{p.instrument.name || p.instrument.isin}</p>
                    <p className="text-xs text-on-surface-variant font-label">
                      {prettyInstrumentType(p.instrument.instrument_type)}
                    </p>
                  </div>
                </div>
              </td>
              <td className="py-4 px-6 text-right font-headline tabular-nums">
                {formatCurrency(p.current_price, p.currency)}
              </td>
              <td
                className={`py-4 px-6 text-right font-headline tabular-nums ${
                  p.daily_pnl_abs >= 0 ? 'text-primary' : 'text-error'
                }`}
              >
                {p.daily_pnl_abs >= 0 ? '+' : ''}
                {formatPercent(p.daily_pnl_rel, 2)}
              </td>
              <td
                className={`py-4 px-6 text-right font-headline tabular-nums ${
                  p.total_pnl_abs >= 0 ? 'text-primary' : 'text-error'
                }`}
              >
                {p.total_pnl_abs >= 0 ? '+' : ''}
                {formatPercent(p.total_pnl_rel, 1)}
              </td>
              <td className="py-4 px-6 text-right font-headline font-medium tabular-nums">
                {formatCurrency(p.current_value, p.currency)}
              </td>
              <td className="py-4 px-6 text-right tabular-nums text-on-surface-variant">
                {formatPercent(p.weight_pct, 1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function depotLabel(d: Depot, idx: number): string {
  const t = d.depot_type?.trim();
  return t ? t : `Depot ${idx + 1}`;
}

function bestandslisteSubtitle(
  depots: Depot[] | undefined,
  selected: DepotSelection,
): string {
  if (!depots || depots.length === 0) return '';
  if (depots.length === 1) return depotLabel(depots[0], 0);
  if (selected === ALL_DEPOTS) return `${depots.length} Depots zusammengefasst`;
  const idx = depots.findIndex((d) => d.depot_id === selected);
  return idx >= 0 ? depotLabel(depots[idx], idx) : '';
}

// When showing positions across multiple depots, the per-depot weight_pct
// from the backend doesn't sum to 100%. Recompute against the union total so
// the Gewichtung column stays meaningful.
function selectPositions(
  depots: Depot[] | undefined,
  byDepotId: Record<string, Position[]>,
  selected: DepotSelection,
): Position[] {
  if (!depots || depots.length === 0) return [];
  if (selected !== ALL_DEPOTS) {
    return byDepotId[selected] ?? [];
  }
  const union = depots.flatMap((d) => byDepotId[d.depot_id] ?? []);
  if (depots.length <= 1) return union;
  const total = union.reduce((sum, p) => sum + p.current_value, 0);
  if (total <= 0) return union;
  return union.map((p) => ({
    ...p,
    weight_pct: (p.current_value / total) * 100,
  }));
}

function DepotTabs({
  depots,
  selected,
  onSelect,
}: {
  depots: Depot[];
  selected: DepotSelection;
  onSelect: (next: DepotSelection) => void;
}) {
  return (
    <div
      className="px-6 py-3 flex flex-wrap gap-1 border-b border-white/5 bg-surface-container-lowest"
      role="tablist"
      aria-label="Depot-Auswahl"
    >
      <DepotTabButton
        label="Alle Depots"
        active={selected === ALL_DEPOTS}
        onClick={() => onSelect(ALL_DEPOTS)}
      />
      {depots.map((d, i) => (
        <DepotTabButton
          key={d.depot_id}
          label={depotLabel(d, i)}
          active={selected === d.depot_id}
          onClick={() => onSelect(d.depot_id)}
        />
      ))}
    </div>
  );
}

type DepotTabButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  key?: string;
};

function DepotTabButton({ label, active, onClick }: DepotTabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
        active
          ? 'bg-primary text-on-primary'
          : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  );
}

function prettyInstrumentType(t: string | null): string {
  switch ((t || '').toUpperCase()) {
    case 'SHARE':
    case 'STOCK':
      return 'Aktie';
    case 'FUND':
    case 'ETF':
      return 'ETF / Fonds';
    case 'BOND':
    case 'BONDS':
      return 'Anleihe';
    default:
      return t || 'Wertpapier';
  }
}
