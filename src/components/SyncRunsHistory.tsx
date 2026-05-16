import { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, History, Loader2, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { type SyncRun, type SyncRunStatus, useSyncRuns } from '../api/sync';
import { qk } from '../lib/queryKeys';
import { formatDate, formatRelativeDate } from '../lib/format';

// Query-key prefixes that point at data which gets stale once a sync run
// transitions from 'running' → terminal. Listed centrally so we don't drift
// from the qk factory.
const STALE_AFTER_SYNC_PREFIXES: readonly (readonly unknown[])[] = [
  qk.transactions.all,
  ['aggregates'],
  qk.categorization.pending,
  ['portfolio'],
];

export default function SyncRunsHistory() {
  const queryClient = useQueryClient();
  const { data: runs, isPending, isFetching, isError } = useSyncRuns(20);

  // Watch the newest run. When it flips from 'running' → 'succeeded' / 'failed'
  // there is fresh data on the backend → invalidate the dependent queries so
  // Transactions, Aggregates, Pending-Review and Portfolio refetch on their own.
  const prevTopStatusRef = useRef<SyncRunStatus | null>(null);
  const topStatus = runs && runs.length > 0 ? runs[0].status : null;
  useEffect(() => {
    const prev = prevTopStatusRef.current;
    if (
      prev === 'running' &&
      (topStatus === 'succeeded' || topStatus === 'failed')
    ) {
      for (const prefix of STALE_AFTER_SYNC_PREFIXES) {
        queryClient.invalidateQueries({ queryKey: prefix });
      }
    }
    prevTopStatusRef.current = topStatus;
  }, [topStatus, queryClient]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['sync-runs'] });
  };

  return (
    <section className="bg-surface-container-low rounded-2xl border border-white/5 p-6">
      <header className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-headline font-bold text-on-surface">Sync-Verlauf</h3>
            <p className="text-xs text-on-surface-variant">
              Letzte 20 Datenabgleiche und Re-Normalisierungen
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isFetching}
          className="text-xs text-on-surface-variant hover:text-on-surface flex items-center gap-1.5 disabled:opacity-40"
          aria-label="Sync-Verlauf neu laden"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </header>

      {isPending ? (
        <SkeletonRows />
      ) : isError ? (
        <p className="text-sm text-error" role="alert">
          Sync-Verlauf konnte nicht geladen werden.
        </p>
      ) : runs && runs.length > 0 ? (
        <RunsTable runs={runs} />
      ) : (
        <p className="text-sm text-on-surface-variant py-6 text-center">
          Noch keine Syncs gelaufen. Klick oben auf «Sync», um den ersten zu starten.
        </p>
      )}
    </section>
  );
}

function RunsTable({ runs }: { runs: SyncRun[] }) {
  return (
    <div className="overflow-x-auto -mx-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            <th className="px-6 pb-3">Status</th>
            <th className="px-3 pb-3">Typ</th>
            <th className="px-3 pb-3">Quelle</th>
            <th className="px-3 pb-3">Gestartet</th>
            <th className="px-3 pb-3 text-right">Dauer</th>
            <th className="px-3 pb-3 text-right">Zeilen</th>
            <th className="px-6 pb-3">Fehler</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {runs.map((r) => (
            <RunRow key={r.id} run={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type RunRowProps = {
  run: SyncRun;
  key?: string;
};

function RunRow({ run }: RunRowProps) {
  return (
    <tr className="hover:bg-white/5 transition-colors">
      <td className="px-6 py-3">
        <StatusBadge status={run.status} />
      </td>
      <td className="px-3 py-3 text-xs text-on-surface-variant">{prettySource(run.source)}</td>
      <td className="px-3 py-3 text-xs text-on-surface-variant">
        {run.data_source ? (
          prettyDataSource(run.data_source)
        ) : (
          <span className="text-on-surface-variant/40">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-on-surface" title={formatDate(run.started_at, 'dd.MM.yyyy HH:mm:ss')}>
        {formatRelativeDate(run.started_at)}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-on-surface">
        {formatDuration(run.started_at, run.finished_at)}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-on-surface">{run.rows_processed}</td>
      <td className="px-6 py-3 max-w-xs">
        {run.error ? (
          <span className="text-xs text-error truncate block" title={run.error}>
            {run.error}
          </span>
        ) : (
          <span className="text-xs text-on-surface-variant/40">—</span>
        )}
      </td>
    </tr>
  );
}

type StatusBadgeProps = {
  status: SyncRunStatus;
};

function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CFG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${cfg.cls}`}
    >
      <Icon className={`w-3 h-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {cfg.label}
    </span>
  );
}

const STATUS_CFG: Record<SyncRunStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> =
  {
    succeeded: {
      label: 'Erfolgreich',
      cls: 'bg-primary/15 text-primary',
      icon: CheckCircle2,
    },
    failed: {
      label: 'Fehler',
      cls: 'bg-error/15 text-error',
      icon: AlertCircle,
    },
    running: {
      label: 'Läuft',
      cls: 'bg-secondary/15 text-secondary',
      icon: Loader2,
    },
  };

function prettySource(source: string): string {
  switch (source) {
    case 'raw_import':
      return 'Datenabgleich';
    case 'normalize':
      return 'Re-Normalisierung';
    default:
      return source;
  }
}

function prettyDataSource(source: string): string {
  switch (source) {
    case 'comdirect':
      return 'Comdirect';
    case 'paypal':
      return 'PayPal';
    default:
      return source;
  }
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return '—';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1).replace('.', ',')} s`;
  const m = Math.floor(s / 60);
  const remSec = Math.round(s - m * 60);
  return `${m}m ${remSec}s`;
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-10 w-full bg-white/5 animate-pulse rounded-lg" />
      ))}
    </div>
  );
}
