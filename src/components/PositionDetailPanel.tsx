import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { isAxiosError } from 'axios';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  History,
  Info,
  PieChart,
  Save,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';

import {
  useBackfillPrices,
  useDepotTransactions,
  useInstrumentPrices,
  usePatchInstrument,
} from '../api/portfolio';
import { formatCurrency, formatDate } from '../lib/format';
import { computeCostBasis, type CostBasisStats } from '../lib/positionStats';
import type {
  DepotTransaction,
  DepotTransactionType,
  InstrumentPricePoint,
  Position,
} from '../api/types';

/**
 * Drill-down side-panel for a portfolio position.
 *
 * Decision: side-panel slides in from the right (vs. centered modal) so
 * the user keeps the table row in peripheral vision. Width is constrained
 * to ~36rem on desktop; on smaller viewports it stretches close to full
 * width. Esc + backdrop-click close it.
 *
 * Three sub-sections:
 *   1. Header: ISIN, name, current/purchase value
 *   2. Ticker form (PATCH /portfolio/instruments/{isin})
 *   3. Backfill form (POST .../backfill-prices) — disabled until ticker set
 *   4. Performance chart (GET .../prices) — Recharts LineChart
 *
 * Currency-mismatch responses (HTTP 400 with "yfinance returns X for
 * ticker Y, instrument is in Z" detail) are surfaced as an inline error
 * banner below the backfill form, plus a non-dismissable warning so the
 * user knows the ticker/currency combo is invalid.
 */

const ISO_DATE = 'yyyy-MM-dd';

function todayIso(): string {
  return format(new Date(), ISO_DATE);
}

function oneMonthAgoIso(): string {
  return format(subMonths(new Date(), 1), ISO_DATE);
}

// 5 calendar years rounded up to 1827 days — mirrors `_BACKFILL_MAX_DAYS`
// in src/api/schemas.py. Backend rejects wider windows with 422; we cap
// the form before the request so the user gets immediate feedback.
const BACKFILL_MAX_DAYS = 5 * 365 + 2;

function diffDays(fromIso: string, toIso: string): number {
  const fromMs = parseISO(fromIso).getTime();
  const toMs = parseISO(toIso).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return 0;
  return Math.round((toMs - fromMs) / (1000 * 60 * 60 * 24));
}

// Heuristic — backend wraps the upstream `CurrencyMismatchError` message
// verbatim into an HTTP 400 detail (see `internal_portfolio_backfill_prices`
// in main.py). We match on a stable substring rather than the full
// message so phrasing tweaks don't break the inline hint.
function isCurrencyMismatch(detail: string): boolean {
  const lc = detail.toLowerCase();
  return lc.includes('yfinance returns') && lc.includes('instrument is in');
}

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  }
  return fallback;
}

type ChartPoint = {
  date: string;
  label: string;
  close: number;
  currency: string;
};

function toChartData(points: InstrumentPricePoint[]): ChartPoint[] {
  return points.map((p) => ({
    date: p.price_date,
    // Recharts XAxis tick — short German format keeps ticks legible.
    label: format(parseISO(p.price_date), 'dd.MM.', { locale: de }),
    close: p.close,
    currency: p.currency,
  }));
}

// Cost-basis + P&L logic lives in `src/lib/positionStats.ts`. See the
// doc-block there for method (weighted-average) and conventions.

function PriceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-surface-container-highest border border-white/10 rounded-lg px-4 py-3 shadow-2xl text-xs">
      <p className="font-bold text-on-surface mb-1 uppercase tracking-wider">
        {formatDate(p.date)}
      </p>
      <p className="text-primary font-bold tabular-nums">
        {formatCurrency(p.close, p.currency)}
      </p>
    </div>
  );
}

export type PositionDetailPanelProps = {
  position: Position | null;
  onClose: () => void;
};

export default function PositionDetailPanel({
  position,
  onClose,
}: PositionDetailPanelProps) {
  // Esc-to-close. Bound only while the panel is open so it doesn't fight
  // the parent page's keyboard shortcuts when the panel is hidden.
  useEffect(() => {
    if (!position) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [position, onClose]);

  return (
    <AnimatePresence>
      {position && <PanelInner position={position} onClose={onClose} />}
    </AnimatePresence>
  );
}

function PanelInner({
  position,
  onClose,
}: {
  position: Position;
  onClose: () => void;
}) {
  const { instrument } = position;

  // ── Ticker form ────────────────────────────────────────────────
  const [ticker, setTicker] = useState<string>(instrument.ticker_symbol ?? '');
  const [tickerError, setTickerError] = useState<string | null>(null);
  const [tickerSavedAt, setTickerSavedAt] = useState<number | null>(null);
  // Re-sync when the user clicks a different position without unmounting
  // the panel (rare today but cheap to support).
  useEffect(() => {
    setTicker(instrument.ticker_symbol ?? '');
    setTickerError(null);
    setTickerSavedAt(null);
  }, [instrument.isin, instrument.ticker_symbol]);

  const patchInstrument = usePatchInstrument(instrument.isin);

  const handleSaveTicker = async () => {
    setTickerError(null);
    const trimmed = ticker.trim();
    if (!trimmed) {
      setTickerError('Ticker darf nicht leer sein.');
      return;
    }
    try {
      await patchInstrument.mutateAsync(trimmed);
      setTickerSavedAt(Date.now());
    } catch (err) {
      setTickerError(extractError(err, 'Ticker konnte nicht gespeichert werden.'));
    }
  };

  // ── Backfill form ──────────────────────────────────────────────
  const [fromDate, setFromDate] = useState<string>(oneMonthAgoIso());
  const [toDate, setToDate] = useState<string>(todayIso());
  const [backfillError, setBackfillError] = useState<string | null>(null);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [currencyMismatch, setCurrencyMismatch] = useState<string | null>(null);

  const backfillPrices = useBackfillPrices(instrument.isin);

  // The "current ticker on the instrument" is what the backend will use,
  // not the (possibly unsaved) form value. Keep them in sync visually so
  // the user must Save before backfill becomes meaningful.
  const persistedTicker = instrument.ticker_symbol;
  const tickerDirty = ticker.trim() !== (persistedTicker ?? '');

  const rangeDays = diffDays(fromDate, toDate);
  const rangeInvalid = rangeDays < 0;
  const rangeTooWide = rangeDays > BACKFILL_MAX_DAYS;
  const canBackfill =
    Boolean(persistedTicker) &&
    !tickerDirty &&
    !rangeInvalid &&
    !rangeTooWide &&
    !backfillPrices.isPending;

  const handleBackfill = async () => {
    setBackfillError(null);
    setBackfillResult(null);
    setCurrencyMismatch(null);
    try {
      const res = await backfillPrices.mutateAsync({
        from_date: fromDate,
        to_date: toDate,
      });
      setBackfillResult(
        `${res.inserted_points} neu, ${res.skipped_existing} bereits vorhanden ` +
          `(${res.fetched_points} insgesamt von ${res.source}).`,
      );
    } catch (err) {
      const detail = extractError(err, 'Backfill fehlgeschlagen.');
      if (isAxiosError(err) && err.response?.status === 400 && isCurrencyMismatch(detail)) {
        setCurrencyMismatch(detail);
      } else {
        setBackfillError(detail);
      }
    }
  };

  // ── Prices query ───────────────────────────────────────────────
  // Open-ended on both sides — show whatever the backend has cached for
  // this ISIN. The chart only re-renders when the cache key changes,
  // which happens automatically after backfill thanks to the mutation's
  // onSuccess invalidator.
  const { data: prices, isPending: pricesPending } = useInstrumentPrices(
    instrument.isin,
    null,
    null,
  );
  const chartData = useMemo(() => toChartData(prices ?? []), [prices]);

  // ── Depot transactions (filtered to this ISIN) ─────────────────
  // Backend exposes the list per-depot only — no ISIN filter param —
  // so we fetch the depot slice and trim client-side. 500 is the
  // backend's hard cap and is sufficient for any one ISIN's history
  // in a personal-finance depot.
  const { data: depotTxData, isPending: depotTxPending } = useDepotTransactions(
    position.depot_id,
    500,
  );
  const positionTxs = useMemo<DepotTransaction[]>(() => {
    const all = depotTxData?.items ?? [];
    return all.filter((t) => t.isin === instrument.isin);
  }, [depotTxData, instrument.isin]);

  // Cost basis + realized/unrealized P&L computed entirely from the
  // filtered list — see the `computeCostBasis` doc-block for method.
  const stats = useMemo(
    () => computeCostBasis(positionTxs, position.current_value),
    [positionTxs, position.current_value],
  );

  // ── Render ─────────────────────────────────────────────────────
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        aria-hidden="true"
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-2xl bg-surface-container-low border-l border-white/5 shadow-2xl overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={`Positions-Details: ${instrument.name || instrument.isin}`}
      >
        <header className="sticky top-0 bg-surface-container-low/95 backdrop-blur-md z-10 border-b border-white/5 p-6 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-headline font-bold text-on-surface truncate">
              {instrument.name || instrument.isin}
            </h2>
            <p className="text-xs text-on-surface-variant font-mono mt-1">
              ISIN {instrument.isin}
              {instrument.wkn ? ` · WKN ${instrument.wkn}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="p-2 -m-2 text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-6 space-y-8">
          <section aria-label="Position-Werte" className="grid grid-cols-3 gap-3">
            <ValueTile
              label="Stück"
              value={position.quantity.toLocaleString('de-DE', {
                maximumFractionDigits: 4,
              })}
            />
            <ValueTile
              label="Marktwert"
              value={formatCurrency(position.current_value, position.currency)}
            />
            <ValueTile
              label="Einstand"
              value={formatCurrency(position.purchase_value, position.currency)}
            />
          </section>

          <TickerForm
            ticker={ticker}
            onTickerChange={setTicker}
            persistedTicker={persistedTicker}
            isPending={patchInstrument.isPending}
            error={tickerError}
            savedAt={tickerSavedAt}
            onSave={handleSaveTicker}
            instrumentCurrency={instrument.currency}
          />

          <BackfillForm
            fromDate={fromDate}
            toDate={toDate}
            onFromChange={setFromDate}
            onToChange={setToDate}
            tickerSet={Boolean(persistedTicker)}
            tickerDirty={tickerDirty}
            rangeInvalid={rangeInvalid}
            rangeTooWide={rangeTooWide}
            isPending={backfillPrices.isPending}
            onBackfill={handleBackfill}
            canBackfill={canBackfill}
            error={backfillError}
            result={backfillResult}
            currencyMismatch={currencyMismatch}
          />

          <PnlCard
            stats={stats}
            currency={position.currency}
            isPending={depotTxPending}
            txCount={positionTxs.length}
          />

          <TxHistoryTable
            txs={positionTxs}
            currency={position.currency}
            isPending={depotTxPending}
          />

          <PerformanceChart
            data={chartData}
            isPending={pricesPending}
            currency={instrument.currency}
          />
        </div>
      </motion.aside>
    </>
  );
}

function ValueTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container rounded-xl p-4 border border-white/5">
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">
        {label}
      </p>
      <p className="font-headline font-bold text-on-surface tabular-nums truncate">
        {value}
      </p>
    </div>
  );
}

type TickerFormProps = {
  ticker: string;
  onTickerChange: (next: string) => void;
  persistedTicker: string | null;
  isPending: boolean;
  error: string | null;
  savedAt: number | null;
  onSave: () => void;
  instrumentCurrency: string;
};

function TickerForm({
  ticker,
  onTickerChange,
  persistedTicker,
  isPending,
  error,
  savedAt,
  onSave,
  instrumentCurrency,
}: TickerFormProps) {
  const trimmed = ticker.trim();
  const dirty = trimmed !== (persistedTicker ?? '');
  const justSaved = savedAt !== null && Date.now() - savedAt < 4_000;

  return (
    <section
      className="bg-surface-container-lowest rounded-2xl p-5 border border-white/5"
      aria-labelledby="ticker-form-heading"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <TrendingUp className="w-4 h-4" />
        </div>
        <div>
          <h3
            id="ticker-form-heading"
            className="font-headline font-bold text-on-surface text-sm"
          >
            Ticker-Symbol
          </h3>
          <p className="text-xs text-on-surface-variant">
            Yahoo-Finance-Symbol für Preis-Backfill (z.B. SAP.DE, AAPL).
            Position wird in <span className="font-bold">{instrumentCurrency}</span> geführt.
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={ticker}
          onChange={(e) => onTickerChange(e.target.value)}
          placeholder="z.B. SAP.DE"
          aria-label="Ticker-Symbol"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 bg-surface-container border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary/50"
        />
        <button
          type="submit"
          disabled={isPending || !trimmed || !dirty}
          className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-bold flex items-center gap-2 hover:brightness-110 transition-all disabled:opacity-40"
        >
          <Save className="w-4 h-4" />
          {isPending ? 'Speichere…' : 'Speichern'}
        </button>
      </form>

      {error && (
        <p className="mt-3 text-xs text-error font-bold" role="alert">
          {error}
        </p>
      )}
      {justSaved && !error && (
        <p
          className="mt-3 text-xs text-primary font-bold flex items-center gap-1"
          role="status"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Ticker gespeichert.
        </p>
      )}
    </section>
  );
}

type BackfillFormProps = {
  fromDate: string;
  toDate: string;
  onFromChange: (next: string) => void;
  onToChange: (next: string) => void;
  tickerSet: boolean;
  tickerDirty: boolean;
  rangeInvalid: boolean;
  rangeTooWide: boolean;
  isPending: boolean;
  onBackfill: () => void;
  canBackfill: boolean;
  error: string | null;
  result: string | null;
  currencyMismatch: string | null;
};

function BackfillForm({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  tickerSet,
  tickerDirty,
  rangeInvalid,
  rangeTooWide,
  isPending,
  onBackfill,
  canBackfill,
  error,
  result,
  currencyMismatch,
}: BackfillFormProps) {
  return (
    <section
      className="bg-surface-container-lowest rounded-2xl p-5 border border-white/5"
      aria-labelledby="backfill-form-heading"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
          <Download className="w-4 h-4" />
        </div>
        <div>
          <h3
            id="backfill-form-heading"
            className="font-headline font-bold text-on-surface text-sm"
          >
            Preise nachladen
          </h3>
          <p className="text-xs text-on-surface-variant">
            Holt fehlende Tagespreise via yfinance. Cap: 5 Jahre pro Aufruf.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="text-xs text-on-surface-variant">
          Von
          <input
            type="date"
            value={fromDate}
            onChange={(e) => onFromChange(e.target.value)}
            max={toDate}
            className="mt-1 w-full bg-surface-container border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/50"
          />
        </label>
        <label className="text-xs text-on-surface-variant">
          Bis
          <input
            type="date"
            value={toDate}
            onChange={(e) => onToChange(e.target.value)}
            min={fromDate}
            max={todayIso()}
            className="mt-1 w-full bg-surface-container border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/50"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onBackfill}
        disabled={!canBackfill}
        className="w-full px-4 py-2 bg-secondary/15 border border-secondary/40 text-secondary rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-secondary/25 transition-all disabled:opacity-40"
      >
        <Download className="w-4 h-4" />
        {isPending ? 'Lade Preise…' : 'Preise nachladen'}
      </button>

      {!tickerSet && (
        <p className="mt-3 text-[11px] text-on-surface-variant" role="status">
          Erst Ticker-Symbol speichern, dann Preise nachladen.
        </p>
      )}
      {tickerSet && tickerDirty && (
        <p className="mt-3 text-[11px] text-on-surface-variant" role="status">
          Ungespeicherte Ticker-Änderung — bitte erst Speichern.
        </p>
      )}
      {rangeInvalid && (
        <p className="mt-3 text-xs text-error font-bold" role="alert">
          Bis-Datum muss nach dem Von-Datum liegen.
        </p>
      )}
      {rangeTooWide && !rangeInvalid && (
        <p className="mt-3 text-xs text-error font-bold" role="alert">
          Zeitraum überschreitet 5-Jahres-Limit.
        </p>
      )}

      {currencyMismatch && (
        <div
          role="alert"
          className="mt-4 flex gap-3 p-3 rounded-xl bg-error/10 border border-error/30"
        >
          <AlertTriangle className="w-4 h-4 text-error shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-error mb-1">Währung passt nicht</p>
            <p className="text-on-surface-variant">{currencyMismatch}</p>
            <p className="text-on-surface-variant mt-2">
              Wähle ein Symbol mit der gleichen Währung wie die Position
              (z.B. <code className="text-on-surface">.DE</code> /
              <code className="text-on-surface"> .PA</code> für EUR).
            </p>
          </div>
        </div>
      )}
      {error && !currencyMismatch && (
        <p className="mt-3 text-xs text-error font-bold" role="alert">
          {error}
        </p>
      )}
      {result && !error && !currencyMismatch && (
        <p className="mt-3 text-xs text-primary font-bold" role="status">
          {result}
        </p>
      )}
    </section>
  );
}

type PnlCardProps = {
  stats: CostBasisStats;
  currency: string;
  isPending: boolean;
  txCount: number;
};

function PnlCard({ stats, currency, isPending, txCount }: PnlCardProps) {
  // When the ledger is incomplete (SELL before BUY) or oversold (more
  // sold than ever bought in the visible window), the cost basis and
  // therefore every P&L number is reconstructed from a partial set
  // of transactions. Render the tiles in a neutral tone and tag each
  // value with `~` so the user can't mistake a phantom-gain figure
  // for a confirmed Winner-Position.
  const uncertain = stats.ledgerIncomplete || stats.oversold;
  return (
    <section
      className="bg-surface-container-lowest rounded-2xl p-5 border border-white/5"
      aria-labelledby="pnl-card-heading"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-tertiary/10 flex items-center justify-center text-tertiary">
          <PieChart className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            id="pnl-card-heading"
            className="font-headline font-bold text-on-surface text-sm"
          >
            Kumulierter P&amp;L
          </h3>
          <p className="text-xs text-on-surface-variant">
            Aus {txCount} Buchung{txCount === 1 ? '' : 'en'} dieser ISIN.
          </p>
        </div>
        <span
          className="text-[11px] uppercase tracking-widest text-on-surface-variant font-bold tabular-nums shrink-0"
          aria-label="Durchschnittliche Kostenbasis"
          title="Gewichtete durchschnittliche Kostenbasis pro Stück"
        >
          {stats.currentQuantity > 0 && !isPending
            ? `Ø ${formatCurrency(stats.avgCostPerShare, currency)}`
            : 'Ø —'}
        </span>
      </div>

      {uncertain && !isPending && (
        <div
          role="alert"
          className="mb-4 flex gap-3 p-3 rounded-xl bg-amber-400/10 border border-amber-400/30"
        >
          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-amber-300 mb-1">
              Lückenhafte Buchungshistorie — P&amp;L-Schätzung kann falsch sein
            </p>
            <p className="text-on-surface-variant">
              {stats.oversold
                ? 'Es wurden mehr Stücke verkauft, als BUY-Buchungen vorliegen — die ältesten Käufe fehlen vermutlich im Datensatz. Realisierter P&L ist näherungsweise.'
                : 'Verkäufe vor erstem BUY — Comdirect-Historie reicht nicht weit genug zurück. Kostenbasis kann unvollständig sein.'}
            </p>
          </div>
        </div>
      )}

      {isPending ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-16 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-16 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-16 bg-white/5 rounded-xl animate-pulse" />
        </div>
      ) : (
        // 2×2 grid so the user can reconcile sales- and dividend-side
        // P&L against Anlage KAP separately. Sales and dividends are
        // both pre-tax / brutto figures from the Comdirect feed —
        // KapSt + Soli are not yet deducted here.
        <div className="grid grid-cols-2 gap-3">
          <PnlTile
            label="Realisiert (Verkäufe, Ø)"
            value={stats.salesPnl}
            currency={currency}
            uncertain={uncertain}
          />
          <PnlTile
            label="Dividenden (brutto)"
            value={stats.dividendsPnl}
            currency={currency}
            uncertain={uncertain}
          />
          <PnlTile
            label="Unrealisiert"
            value={stats.unrealizedPnl}
            currency={currency}
            uncertain={uncertain}
          />
          <PnlTile
            label="Gesamt"
            value={stats.totalPnl}
            currency={currency}
            emphasis
            uncertain={uncertain}
          />
        </div>
      )}

      {!isPending && (
        <p
          className="mt-3 text-[11px] text-on-surface-variant leading-relaxed flex items-start gap-1.5"
          role="note"
        >
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-on-surface-variant" />
          <span>
            P&amp;L hier ist <span className="font-bold">gewichteter Durchschnitt</span>.
            Steuerlich relevant ist die <span className="font-bold">FIFO</span>-Berechnung
            der Comdirect (§20 EStG für Wertpapiere ab 2009) — siehe
            Jahressteuerbescheinigung.
          </span>
        </p>
      )}
    </section>
  );
}

function PnlTile({
  label,
  value,
  currency,
  emphasis = false,
  uncertain = false,
}: {
  label: string;
  value: number;
  currency: string;
  emphasis?: boolean;
  uncertain?: boolean;
}) {
  // Sign-driven color so the user reads the row at a glance. Tile is
  // neutral when value is exactly 0 (matches the row hover state in
  // the parent table for consistency). When the underlying ledger is
  // incomplete, force a neutral tone regardless of sign and prefix
  // the value with `~` — green/red on a phantom-gain number reads as
  // a Winner-Position to a glancing user.
  const tone = uncertain
    ? 'text-on-surface-variant'
    : value > 0
      ? 'text-primary'
      : value < 0
        ? 'text-error'
        : 'text-on-surface';
  const formatted = formatCurrency(value, currency);
  // `~` on a positive value sits before any leading sign space — keep
  // it visually distinct from the digits ("~+150 €" not "+~150 €").
  const display = uncertain ? `~${formatted}` : formatted;
  return (
    <div
      className={`bg-surface-container rounded-xl p-4 border ${
        emphasis && !uncertain ? 'border-tertiary/30' : 'border-white/5'
      }`}
    >
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">
        {label}
      </p>
      <p
        className={`font-headline font-bold tabular-nums truncate ${tone}`}
        aria-label={
          uncertain
            ? `${label} (Schätzung): ${formatted}`
            : `${label}: ${formatted}`
        }
      >
        {display}
      </p>
    </div>
  );
}

const TX_TYPE_LABEL: Record<DepotTransactionType, string> = {
  BUY: 'Kauf',
  SELL: 'Verkauf',
  DIVIDEND: 'Dividende',
  OTHER: 'Sonstiges',
};

const TX_TYPE_TONE: Record<DepotTransactionType, string> = {
  BUY: 'bg-primary/15 text-primary border-primary/30',
  SELL: 'bg-error/15 text-error border-error/30',
  DIVIDEND: 'bg-tertiary/15 text-tertiary border-tertiary/30',
  OTHER: 'bg-on-surface/10 text-on-surface-variant border-white/10',
};

// Above this length, the table starts collapsed. Tuned against the
// brief — the user wants > 20 rows to fold by default.
const TX_HISTORY_COLLAPSE_THRESHOLD = 20;

function TxHistoryTable({
  txs,
  currency,
  isPending,
}: {
  txs: DepotTransaction[];
  currency: string;
  isPending: boolean;
}) {
  // Newest-first for the operator's mental model — same default as the
  // backend's depot-transactions list.
  const sorted = useMemo<DepotTransaction[]>(
    () =>
      [...txs].sort((a, b) => {
        if (a.booking_date !== b.booking_date) {
          return a.booking_date < b.booking_date ? 1 : -1;
        }
        return a.transaction_id < b.transaction_id ? 1 : -1;
      }),
    [txs],
  );

  const collapsible = sorted.length > TX_HISTORY_COLLAPSE_THRESHOLD;
  const [expanded, setExpanded] = useState(false);
  const visible: DepotTransaction[] =
    collapsible && !expanded ? sorted.slice(0, TX_HISTORY_COLLAPSE_THRESHOLD) : sorted;

  return (
    <section
      className="bg-surface-container-lowest rounded-2xl p-5 border border-white/5"
      aria-labelledby="tx-history-heading"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
          <History className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            id="tx-history-heading"
            className="font-headline font-bold text-on-surface text-sm"
          >
            Buchungs-Historie
          </h3>
          <p className="text-xs text-on-surface-variant">
            Käufe, Verkäufe und Dividenden für diese ISIN
            {sorted.length > 0 ? ` (${sorted.length})` : ''}.
          </p>
        </div>
      </div>

      {isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center">
          <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
            Keine Depot-Buchungen für diese ISIN gefunden. Falls die Position
            via Übertrag entstanden ist, ist die Historie u.U. nicht
            vollständig im k-fin-Cache.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-on-surface-variant">
                  <th scope="col" className="py-2 pr-3 font-bold">Datum</th>
                  <th scope="col" className="py-2 pr-3 font-bold">Typ</th>
                  <th scope="col" className="py-2 pr-3 font-bold text-right">Stück</th>
                  <th scope="col" className="py-2 pr-3 font-bold text-right">Preis</th>
                  <th scope="col" className="py-2 font-bold text-right">Betrag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {visible.map((tx) => (
                  <TxRow key={tx.transaction_id} tx={tx} currency={currency} />
                ))}
              </tbody>
            </table>
          </div>

          {collapsible && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-3 w-full px-3 py-2 text-xs font-bold rounded-lg border border-white/10 bg-surface-container hover:bg-white/5 text-on-surface-variant flex items-center justify-center gap-2 transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Weniger anzeigen
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Alle {sorted.length} Buchungen anzeigen
                </>
              )}
            </button>
          )}
        </>
      )}
    </section>
  );
}

// `key?` is included because this project's TS setup doesn't pick up
// React's `JSX.IntrinsicAttributes` automatically (no @types/react in
// node_modules) — same workaround as `CategoryCardProps` in Categories.tsx.
type TxRowProps = { tx: DepotTransaction; currency: string; key?: string };

function TxRow({ tx, currency }: TxRowProps) {
  // The list is filtered to a single ISIN, so the tx currency should
  // match the position's currency in the common case. If it doesn't —
  // e.g. a USD ADR's dividend booked in EUR — keep the tx's own
  // currency on display so the user sees what the bank actually
  // recorded, never silently re-format into the position currency.
  const txCurrency = tx.currency || currency;
  const type = (tx.transaction_type as DepotTransactionType) ?? 'OTHER';
  const label = TX_TYPE_LABEL[type] ?? type;
  const tone = TX_TYPE_TONE[type] ?? TX_TYPE_TONE.OTHER;

  // Dividends have no meaningful per-share price/quantity in the
  // Comdirect feed — `quantity` is sometimes 0, sometimes the share
  // count at record date. Suppress the columns to avoid implying
  // they're acquisition-relevant.
  const hideQtyPrice = type === 'DIVIDEND';

  return (
    <tr className="hover:bg-white/5">
      <td className="py-2 pr-3 text-on-surface-variant whitespace-nowrap">
        {formatDate(tx.booking_date)}
      </td>
      <td className="py-2 pr-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${tone}`}
        >
          {label}
        </span>
      </td>
      <td className="py-2 pr-3 text-right text-on-surface">
        {hideQtyPrice
          ? '—'
          : Number(tx.quantity).toLocaleString('de-DE', {
              maximumFractionDigits: 4,
            })}
      </td>
      <td className="py-2 pr-3 text-right text-on-surface">
        {hideQtyPrice ? '—' : formatCurrency(tx.price, txCurrency)}
      </td>
      <td className="py-2 text-right text-on-surface font-bold">
        {formatCurrency(tx.amount, txCurrency)}
      </td>
    </tr>
  );
}

function PerformanceChart({
  data,
  isPending,
  currency,
}: {
  data: ChartPoint[];
  isPending: boolean;
  currency: string;
}) {
  return (
    <section
      className="bg-surface-container-lowest rounded-2xl p-5 border border-white/5"
      aria-labelledby="chart-heading"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3
            id="chart-heading"
            className="font-headline font-bold text-on-surface text-sm"
          >
            Kursverlauf
          </h3>
          <p className="text-xs text-on-surface-variant">
            Tages-Schlusskurse aus dem k-fin Cache ({currency}).
          </p>
        </div>
        {data.length > 0 && (
          <span className="text-xs text-on-surface-variant tabular-nums">
            {data.length} Punkte
          </span>
        )}
      </div>

      <div className="h-64 w-full">
        {isPending ? (
          <div className="w-full h-full bg-white/5 rounded-xl animate-pulse" />
        ) : data.length >= 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                stroke="rgba(255,255,255,0.4)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                stroke="rgba(255,255,255,0.4)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={70}
                domain={['auto', 'auto']}
                tickFormatter={(v: number) =>
                  formatCurrency(v, currency).replace(/[ \s]/g, '')
                }
              />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.15)' }}
                content={<PriceTooltip />}
              />
              <Line
                type="monotone"
                dataKey="close"
                stroke="#44d8f1"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/5 rounded-xl border border-dashed border-white/10 text-center px-6">
            <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
              Noch keine Preise im Cache — &laquo;Preise nachladen&raquo; klicken,
              sobald ein Ticker gesetzt ist.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
