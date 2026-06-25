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
  usePortfolioHome,
} from '../api/portfolio';
import { formatCurrency, formatDate } from '../lib/format';
import type {
  Depot,
  PerformancePoint,
  PerformanceRange,
  PortfolioActivity,
  Position,
} from '../api/types';
import PositionDetailPanel from './PositionDetailPanel';

const ALL_DEPOTS = 'all' as const;
type DepotSelection = typeof ALL_DEPOTS | string;

const RANGES: { label: string; value: PerformanceRange }[] = [
  { label: 'Heute', value: '1D' },
  { label: '7T', value: '1W' },
  { label: '30T', value: '1M' },
  { label: '1J', value: '1Y' },
  { label: 'Max', value: 'MAX' },
];

const ALLOCATION_COLORS = ['#44d8f1', '#00bcd4', '#f4bd5f', '#869396', '#a1efff'];

function formatPercent(value: number, digits = 1): string {
  const abs = value.toFixed(digits).replace('.', ',');
  return `${abs} %`;
}

function formatDateShort(value: string): string {
  return formatDate(value, 'dd.MM.');
}

function formatActivityType(type: PortfolioActivity['transaction_type']): string {
  switch (type) {
    case 'BUY':
      return 'Kauf';
    case 'SELL':
      return 'Verkauf';
    case 'DIVIDEND':
      return 'Dividende';
    default:
      return 'Aktivität';
  }
}

function formatActivityAmount(activity: PortfolioActivity): string {
  const amount = formatCurrency(Math.abs(activity.amount), activity.currency);
  switch (activity.transaction_type) {
    case 'BUY':
      return amount;
    case 'SELL':
    case 'DIVIDEND':
      return `+${amount}`;
    default:
      return activity.amount >= 0 ? `+${amount}` : `-${amount}`;
  }
}

function activityAmountClass(activity: PortfolioActivity): string {
  if (activity.transaction_type === 'DIVIDEND' || activity.transaction_type === 'SELL') {
    return 'text-primary';
  }
  if (activity.transaction_type === 'BUY') {
    return 'text-on-surface';
  }
  return activity.amount >= 0 ? 'text-primary' : 'text-error';
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
  // Drill-down side-panel state. We keep the full Position object around
  // (rather than just an ISIN) so the panel header can render header
  // values immediately without waiting for a re-fetch.
  const [drilldown, setDrilldown] = useState<Position | null>(null);

  const { data: home, isPending: isHomePending, isError: isHomeError } = usePortfolioHome(range);
  const summary = home?.summary;
  const allocation = home?.allocation;
  const performance = home?.performance;
  const activities = home?.activities ?? [];
  const { data: depots } = useDepots();

  const { byDepotId, isPending: isPositionsPending } = useAllPositions(depots);

  const visiblePositions = useMemo(
    () => selectPositions(depots, byDepotId, selectedDepot),
    [depots, byDepotId, selectedDepot],
  );

  // After a refetch, the Position reference identity changes — re-pick the
  // updated row by ISIN+depot so the side-panel reflects fresh ticker /
  // value data without forcing the user to reopen it.
  const drilldownLive = useMemo(() => {
    if (!drilldown) return null;
    const match = visiblePositions.find(
      (p) =>
        p.depot_id === drilldown.depot_id &&
        p.instrument.isin === drilldown.instrument.isin,
    );
    return match ?? drilldown;
  }, [drilldown, visiblePositions]);

  const chart = useMemo(
    () => (performance ? buildChartPaths(performance) : null),
    [performance],
  );

  const dailyPositive = (summary?.daily_pnl_abs ?? 0) >= 0;
  const totalPositive = (summary?.total_pnl_abs ?? 0) >= 0;
  const assetClassCount = allocation?.length ?? 0;
  const currency = summary ? portfolioCurrency(depots, visiblePositions) : 'EUR';
  return (
    <div className="pt-24 px-4 md:px-8 pb-28 md:pb-12 overflow-y-auto h-screen space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-6xl"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-surface-container-low border border-white/10 flex items-center justify-center text-primary">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-headline text-2xl font-extrabold text-on-surface">
              Alle Depots
            </h2>
            <p className="text-sm text-on-surface-variant">
              Home-Kennzahlen und Aktivitäten zeigen das Gesamtportfolio.
            </p>
          </div>
        </div>

        {isHomeError && (
          <div className="mb-6 rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-sm text-error">
            Portfolio-Home konnte nicht geladen werden. Bitte Backend-Deployment prüfen.
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <div
            className="grid flex-1 grid-cols-5 rounded-xl bg-surface-container-high p-1"
            role="tablist"
            aria-label="Zeitraum"
          >
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRange(r.value)}
                className={`h-11 rounded-lg text-sm font-bold transition-colors ${
                  r.value === range
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                role="tab"
                aria-selected={r.value === range}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-surface-container-low px-5 py-8 md:px-10 md:py-10">
          <div className="mx-auto max-w-3xl">
            <PortfolioArc
              value={summary?.total_value ?? 0}
              pnlAbs={summary?.total_pnl_abs ?? 0}
              pnlRel={summary?.total_pnl_rel ?? 0}
              currency={currency}
              assetClassCount={assetClassCount}
              positionsCount={summary?.positions_count ?? visiblePositions.length}
              pending={isHomePending}
            />
          </div>
        </div>
      </motion.section>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Investiert"
          value={summary ? formatCurrency(summary.total_purchase_value, currency) : '—'}
          hint={summary ? `${summary.depots_count} Depot${summary.depots_count === 1 ? '' : 's'}` : ''}
          icon={Wallet}
          tone="neutral"
          pending={isHomePending}
        />
        <KpiCard
          label="G/V Heute"
          value={summary ? formatCurrency(summary.daily_pnl_abs, currency) : '—'}
          hint={summary ? formatPercent(summary.daily_pnl_rel, 2) : ''}
          icon={dailyPositive ? ArrowUpRight : ArrowDownRight}
          tone={dailyPositive ? 'primary' : 'danger'}
          pending={isHomePending}
        />
        <KpiCard
          label="Gesamtrendite"
          value={summary ? formatCurrency(summary.total_pnl_abs, currency) : '—'}
          hint={summary ? formatPercent(summary.total_pnl_rel, 1) : ''}
          icon={LineChart}
          tone={totalPositive ? 'primary' : 'danger'}
          pending={isHomePending}
        />
        <KpiCard
          label="Dividendenrendite"
          value={summary ? formatPercent(summary.dividend_yield_pct, 2) : '—'}
          hint="Letzte 12 Monate"
          icon={BadgeDollarSign}
          tone="gold"
          pending={isHomePending}
        />
      </section>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 xl:grid-cols-3 gap-6">
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
            <div className="hidden sm:flex gap-1 bg-surface-container-high rounded-lg p-1">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    r.value === range
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {r.label}
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
      </section>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-6xl bg-surface-container-low rounded-2xl border border-white/5 overflow-hidden"
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
        <PositionsTable
          positions={visiblePositions}
          isPending={isPositionsPending}
          onSelect={setDrilldown}
          selectedKey={
            drilldown ? `${drilldown.depot_id}:${drilldown.instrument.isin}` : null
          }
        />
      </motion.div>

      <motion.section
        aria-labelledby="portfolio-activities-heading"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-6xl rounded-2xl border border-white/5 bg-surface-container-low p-6"
      >
        <div className="mb-5">
          <h3
            id="portfolio-activities-heading"
            className="font-headline font-bold text-on-surface text-xl"
          >
            Deine Aktivitäten
          </h3>
          <p className="text-xs text-on-surface-variant">
            Letzte Depotbewegungen aus Käufen, Verkäufen und Dividenden.
          </p>
        </div>
        {activities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {activities.slice(0, 3).map((activity) => (
              <div
                key={activity.transaction_id}
                className="text-left rounded-xl bg-surface-container p-4 border border-white/5 hover:border-primary/40 transition-colors"
              >
                <p className="text-xs text-on-surface-variant mb-2">
                  {formatActivityType(activity.transaction_type)}
                </p>
                <p className="font-headline font-bold text-on-surface truncate">
                  {activity.instrument_name || activity.isin || 'Depotbewegung'}
                </p>
                <p
                  className={`mt-3 font-headline font-extrabold tabular-nums ${activityAmountClass(activity)}`}
                >
                  {formatActivityAmount(activity)}
                </p>
                <p className="mt-2 text-xs text-on-surface-variant">
                  {formatDateShort(activity.booking_date)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-on-surface-variant">
            Noch keine Portfolio-Aktivitäten. Nach dem nächsten Sync erscheinen Bewegungen hier.
          </p>
        )}
      </motion.section>

      <PositionDetailPanel
        position={drilldownLive}
        onClose={() => setDrilldown(null)}
      />
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
        <p className={`text-3xl font-headline font-extrabold tabular-nums ${valueClass}`}>
          {value}
        </p>
      )}
      <p className="text-xs mt-2 text-on-surface-variant font-medium">{hint}</p>
    </motion.div>
  );
}

function PortfolioArc({
  value,
  pnlAbs,
  pnlRel,
  currency,
  assetClassCount,
  positionsCount,
  pending,
}: {
  value: number;
  pnlAbs: number;
  pnlRel: number;
  currency: string;
  assetClassCount: number;
  positionsCount: number;
  pending: boolean;
}) {
  const positive = pnlAbs >= 0;
  const pnlIntensity = Math.min(Math.max(Math.abs(pnlRel) / 30, 0.08), 1);
  const circumference = 314;
  const strokeDashoffset = circumference * (1 - pnlIntensity);

  return (
    <div className="relative mx-auto flex aspect-[1.45/1] w-full max-w-[42rem] items-end justify-center">
      <svg
        className="absolute inset-x-0 bottom-0 h-full w-full"
        viewBox="0 0 420 240"
        role="img"
        aria-label="Portfolio Performance"
      >
        <path
          d="M40 210 A170 170 0 0 1 380 210"
          fill="none"
          stroke="#273452"
          strokeLinecap="butt"
          strokeWidth="34"
        />
        <path
          d="M40 210 A170 170 0 0 1 380 210"
          fill="none"
          stroke={positive ? '#44d8f1' : '#ffb4ab'}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="butt"
          strokeWidth="34"
        />
      </svg>

      <div className="relative z-10 mb-4 flex w-full max-w-md flex-col items-center px-4 text-center">
        {pending ? (
          <div className="mb-4 h-12 w-44 animate-pulse rounded-xl bg-white/5" />
        ) : (
          <p className="mb-3 break-words text-4xl font-headline font-extrabold tabular-nums text-on-surface md:text-5xl">
            {formatCurrency(value, currency)}
          </p>
        )}
        <div className="mb-4 h-px w-full max-w-xs bg-white/10" />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span
            className={`rounded-lg px-3 py-1 text-sm font-headline font-bold tabular-nums ${
              positive ? 'bg-primary/15 text-primary' : 'bg-error/15 text-error'
            }`}
          >
            {pnlAbs >= 0 ? '+' : ''}
            {formatCurrency(pnlAbs, currency)}
          </span>
          <span
            className={`rounded-lg px-3 py-1 text-sm font-headline font-bold tabular-nums ${
              positive ? 'bg-primary/15 text-primary' : 'bg-error/15 text-error'
            }`}
          >
            {pnlRel >= 0 ? '+' : ''}
            {formatPercent(pnlRel, 2)}
          </span>
        </div>
        <p className="mt-5 text-sm text-on-surface-variant">
          {assetClassCount} Assetklassen • {positionsCount} Holdings • {currency}
        </p>
      </div>
    </div>
  );
}

function PositionsTable({
  positions,
  isPending,
  onSelect,
  selectedKey,
}: {
  positions: Position[];
  isPending: boolean;
  onSelect: (position: Position) => void;
  selectedKey: string | null;
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
          {positions.map((p) => {
            const rowKey = `${p.depot_id}:${p.instrument.isin}`;
            const active = rowKey === selectedKey;
            return (
            <tr
              key={rowKey}
              onClick={() => onSelect(p)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(p);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Details: ${p.instrument.name || p.instrument.isin}`}
              aria-pressed={active}
              className={`cursor-pointer hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-inset ${
                active ? 'bg-white/5' : ''
              }`}
            >
              <td className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center border border-white/10 text-on-surface font-bold text-xs">
                    {p.instrument.wkn || p.instrument.isin.slice(0, 4)}
                  </div>
                  <div>
                    <p className="font-medium text-on-surface">{p.instrument.name || p.instrument.isin}</p>
                    <p className="text-xs text-on-surface-variant">
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function depotLabel(d: Depot, idx: number): string {
  const t = d.depot_type?.trim();
  return t ? t : `Depot ${idx + 1}`;
}

function portfolioCurrency(
  depots: Depot[] | undefined,
  positions: Position[],
): string {
  const depotCurrency = depots?.find((d) => d.currency)?.currency;
  return depotCurrency ?? positions.find((p) => p.currency)?.currency ?? 'EUR';
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
