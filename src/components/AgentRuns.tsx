import {
  AlertTriangle,
  Ban,
  Calendar,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Tag,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import {
  useCancelRun,
  useRerunRun,
  useRuns,
  useTriggerFullPipeline,
  useTriggerRun,
} from '../api/runs';
import { formatDate } from '../lib/format';
import type { AgentName, Run, RunStatus } from '../api/types';

type PendingTrigger =
  | { kind: 'full' }
  | { kind: 'single'; agent: AgentMeta };

type AgentMeta = {
  id: AgentName;
  name: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
  model: string;
};

const AGENTS: AgentMeta[] = [
  {
    id: 'categorization',
    name: 'Kategorisierung',
    desc: 'Ordnet Transaktionen automatisch Kategorien zu',
    icon: Tag,
    model: 'Sonnet 4.6',
  },
  {
    id: 'weekly_analysis',
    name: 'Wochenanalyse',
    desc: 'Wöchentliche Auswertung & Trends',
    icon: CalendarRange,
    model: 'Sonnet 4.6',
  },
  {
    id: 'monthly_analysis',
    name: 'Monatsanalyse',
    desc: 'Monatsbericht & Kategorien-Breakdown',
    icon: Calendar,
    model: 'Sonnet 4.6',
  },
  {
    id: 'anomaly',
    name: 'Anomalie-Erkennung',
    desc: 'Findet ungewöhnliche Ausgaben & Muster',
    icon: AlertTriangle,
    model: 'Sonnet 4.6',
  },
  {
    id: 'synthesis',
    name: 'Synthese',
    desc: 'Aggregiert Ergebnisse zu einer Gesamtschau',
    icon: Sparkles,
    model: 'Sonnet 4.6',
  },
];

const STATUS_STYLES: Record<RunStatus, string> = {
  succeeded: 'bg-secondary/10 text-secondary border-secondary/30',
  running: 'bg-primary/10 text-primary border-primary/30',
  pending: 'bg-surface-container-high text-on-surface-variant border-white/10',
  failed: 'bg-error/10 text-error border-error/30',
  cancelled: 'bg-white/5 text-on-surface-variant border-white/15',
};

const STATUS_LABEL: Record<RunStatus, string> = {
  succeeded: 'Erfolgreich',
  running: 'Läuft',
  pending: 'Wartet',
  failed: 'Fehlgeschlagen',
  cancelled: 'Abgebrochen',
};

const FALLBACK_STYLE = 'bg-surface-container-high text-on-surface-variant border-white/10';

// Heartbeat older than this (ms) on a running run hints "stuck?".
const STALE_HEARTBEAT_MS = 3 * 60 * 1000;

function formatDuration(seconds: number): string {
  if (seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function useElapsed(startedAt: string | null, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
}

function estimatedSeconds(runs: Run[] | undefined, agent: string): number | null {
  if (!runs) return null;
  const finished = runs
    .filter((r) => r.agent_name === agent && r.status === 'succeeded' && r.finished_at)
    .slice(0, 5);
  if (finished.length === 0) return null;
  const total = finished.reduce(
    (s, r) =>
      s + (Date.parse(r.finished_at!) - Date.parse(r.started_at)) / 1000,
    0,
  );
  return Math.round(total / finished.length);
}

export default function AgentRuns() {
  const { data: runsData, isPending: isHistoryPending } = useRuns({ limit: 20 });
  const { mutate: triggerRun, isPending: isTriggering, variables: triggeringAgent } =
    useTriggerRun();
  const { mutate: triggerFull, isPending: isTriggeringFull } = useTriggerFullPipeline();
  const {
    mutate: cancelRun,
    isPending: isCancelling,
    variables: cancellingId,
  } = useCancelRun();
  const {
    mutate: rerunRun,
    isPending: isRerunning,
    variables: rerunningId,
    error: rerunError,
    reset: resetRerun,
  } = useRerunRun();

  const [pending, setPending] = useState<PendingTrigger | null>(null);
  // Time-window override for the run-trigger. `null` = "Standard" — backend
  // applies the agent's built-in window and we send no `period_days` param.
  // Custom number values are clamped to [1, 3650] (backend hard cap).
  const [periodDaysOverride, setPeriodDaysOverride] = useState<number | null>(
    null,
  );
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpandedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeRun = runsData?.items.find(
    (r) => r.status === 'pending' || r.status === 'running',
  );
  const hasActiveRun = !!activeRun;
  const activeElapsed = useElapsed(activeRun?.started_at ?? null, hasActiveRun);
  const activeEstimate = activeRun
    ? estimatedSeconds(runsData?.items, activeRun.agent_name)
    : null;
  const activeRemaining =
    activeEstimate !== null ? Math.max(0, activeEstimate - activeElapsed) : null;

  const isAnyTriggering = isTriggering || isTriggeringFull;

  const confirmRun = () => {
    if (!pending) return;
    const period_days = periodDaysOverride ?? undefined;
    if (pending.kind === 'full') {
      triggerFull(
        { period_days },
        { onSettled: () => setPending(null) },
      );
    } else {
      triggerRun(
        { agent_name: pending.agent.id, period_days },
        { onSettled: () => setPending(null) },
      );
    }
  };

  const cancelTargetRun = cancelTargetId
    ? runsData?.items.find((r) => r.id === cancelTargetId) ?? null
    : null;

  const confirmCancel = () => {
    if (!cancelTargetId) return;
    cancelRun(cancelTargetId, { onSettled: () => setCancelTargetId(null) });
  };

  return (
    <div className="pt-24 px-8 pb-12 overflow-y-auto h-screen">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h3 className="text-on-surface-variant text-xs uppercase tracking-[0.2em] font-bold mb-1">
            AI-Pipelines
          </h3>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight">Agents</h1>
        </div>
        {hasActiveRun && activeRun && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 bg-surface-container-low px-4 py-2 rounded-full border border-primary/20">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-bold text-on-surface tabular-nums">
                {formatDuration(activeElapsed)}
                {activeEstimate !== null && (
                  <span className="text-on-surface-variant font-normal">
                    {' '}/ ≈ {formatDuration(activeEstimate)}
                    {activeRemaining !== null && activeRemaining > 0 && (
                      <span> · noch {formatDuration(activeRemaining)}</span>
                    )}
                  </span>
                )}
              </span>
              {activeRun.progress_total ? (
                <span className="text-xs font-medium text-on-surface-variant tabular-nums">
                  · {activeRun.progress_current ?? 0}/{activeRun.progress_total}
                </span>
              ) : null}
            </div>
            {activeRun.status === 'running' && (
              <button
                onClick={() => setCancelTargetId(activeRun.id)}
                disabled={isCancelling && cancellingId === activeRun.id}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full border border-white/10 bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancelling && cancellingId === activeRun.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Ban className="w-3.5 h-3.5" />
                )}
                Abbrechen
              </button>
            )}
          </div>
        )}
      </div>

      <PeriodPicker
        value={periodDaysOverride}
        onChange={setPeriodDaysOverride}
        disabled={isAnyTriggering || hasActiveRun}
      />

      <div className="grid grid-cols-12 gap-6 mb-12">
        <div className="col-span-12 lg:col-span-4">
          <div className="w-full h-full flex flex-col justify-between p-8 bg-surface-container-highest rounded-2xl border-2 border-secondary relative overflow-hidden group transition-all hover:shadow-[0_0_40px_rgba(244,189,95,0.1)]">
            <div className="flex flex-col items-center flex-1 justify-center">
              {isTriggeringFull ? (
                <Loader2 className="w-12 h-12 text-secondary mb-4 animate-spin" />
              ) : (
                <Zap className="w-12 h-12 text-secondary mb-4 fill-secondary" />
              )}
              <span className="font-headline text-2xl font-extrabold text-secondary tracking-tight">
                Full Pipeline
              </span>
              <p className="text-sm text-on-surface-variant mt-2 text-center max-w-[220px]">
                Führt alle 5 Agents nacheinander aus
              </p>
            </div>
            <div className="flex items-center justify-between pt-6 border-t border-white/5 mt-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70 font-mono">
                Sonnet 4.6 + 4
              </span>
              <button
                onClick={() => setPending({ kind: 'full' })}
                disabled={isAnyTriggering || hasActiveRun}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md bg-secondary text-on-secondary hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-3 h-3 fill-on-secondary" />
                Run
              </button>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            const isThisTriggering =
              isTriggering && triggeringAgent?.agent_name === agent.id;
            return (
              <div
                key={agent.id}
                className="flex flex-col p-5 bg-surface-container rounded-xl border border-white/5 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  {isThisTriggering ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span className="font-bold text-on-surface mb-1">{agent.name}</span>
                <span className="text-xs text-on-surface-variant leading-relaxed mb-4">
                  {agent.desc}
                </span>
                <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70 font-mono" title={`Model: ${agent.model}`}>
                    {agent.model}
                  </span>
                  <button
                    onClick={() => setPending({ kind: 'single', agent })}
                    disabled={isAnyTriggering || hasActiveRun}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Play className="w-3 h-3 fill-primary" />
                    Run
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section className="bg-surface-container-low rounded-2xl overflow-hidden border border-white/5">
        <div className="px-8 py-5 border-b border-white/5">
          <h3 className="font-headline text-lg font-bold">Run-Historie</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-on-surface-variant text-[11px] uppercase tracking-widest font-bold bg-surface-container/50">
                <th className="w-10 px-2 py-4"></th>
                <th className="px-6 py-4">Agent</th>
                <th className="px-6 py-4">Trigger</th>
                <th className="px-6 py-4">Gestartet</th>
                <th className="px-6 py-4">Dauer</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isHistoryPending ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="h-8 bg-white/5 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : runsData?.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-16 text-on-surface-variant text-sm"
                  >
                    Noch keine Runs — starte oben einen Agent
                  </td>
                </tr>
              ) : (
                runsData?.items.map((run) => (
                  <RunRow
                    key={run.id}
                    run={run}
                    estimate={estimatedSeconds(runsData?.items, run.agent_name)}
                    expanded={expandedRuns.has(run.id)}
                    onToggleExpand={() => toggleExpand(run.id)}
                    onCancel={() => setCancelTargetId(run.id)}
                    isCancelling={isCancelling && cancellingId === run.id}
                    onRerun={() => {
                      resetRerun();
                      rerunRun(run.id);
                    }}
                    isRerunning={isRerunning && rerunningId === run.id}
                    rerunError={
                      rerunError && rerunningId === run.id ? rerunError : null
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {createPortal(
        <AnimatePresence>
        {cancelTargetRun && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
            onClick={isCancelling ? undefined : () => setCancelTargetId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-surface-container-low border border-white/5 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-on-surface-variant">
                    <Ban className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-on-surface">
                      Run wirklich abbrechen?
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      {AGENT_LABEL[cancelTargetRun.agent_name] ?? cancelTargetRun.agent_name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCancelTargetId(null)}
                  disabled={isCancelling}
                  className="text-on-surface-variant hover:text-on-surface disabled:opacity-30"
                  aria-label="Schließen"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                Bereits verarbeitete Batches bleiben erhalten, aber der Rest des Runs wird gestoppt.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setCancelTargetId(null)}
                  disabled={isCancelling}
                  className="flex-1 bg-surface-container-high hover:bg-surface-container-highest py-3 rounded-xl text-sm font-bold text-on-surface transition-all disabled:opacity-50"
                >
                  Weiterlaufen lassen
                </button>
                <button
                  onClick={confirmCancel}
                  disabled={isCancelling}
                  className="flex-1 bg-error/90 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Breche ab…
                    </>
                  ) : (
                    'Ja, abbrechen'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {pending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
            onClick={isAnyTriggering ? undefined : () => setPending(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-surface-container-low border border-white/5 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {pending.kind === 'full' ? (
                      <Zap className="w-5 h-5" />
                    ) : (
                      <pending.agent.icon className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-on-surface">
                      {pending.kind === 'full'
                        ? 'Full Pipeline starten?'
                        : `${pending.agent.name} starten?`}
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      LLM-Aufrufe können kostenpflichtig sein
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPending(null)}
                  disabled={isAnyTriggering}
                  className="text-on-surface-variant hover:text-on-surface disabled:opacity-30"
                  aria-label="Schließen"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                {pending.kind === 'full'
                  ? 'Es werden alle 5 Agents nacheinander ausgeführt. Dies dauert etwa 30–60 Sekunden und löst mehrere LLM-Anfragen aus.'
                  : pending.agent.desc}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setPending(null)}
                  disabled={isAnyTriggering}
                  className="flex-1 bg-surface-container-high hover:bg-surface-container-highest py-3 rounded-xl text-sm font-bold text-on-surface transition-all disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={confirmRun}
                  disabled={isAnyTriggering}
                  className="flex-1 bg-primary text-on-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {isAnyTriggering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Starte...
                    </>
                  ) : (
                    'Ja, starten'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

// Short model labels — backend stores full IDs like
// "anthropic:claude-haiku-4-5-20251001"; the UI only needs the family + version.
const MODEL_LABEL: Record<string, string> = {
  'anthropic:claude-haiku-4-5-20251001': 'Haiku 4.5',
  'anthropic:claude-haiku-4-5': 'Haiku 4.5',
  'anthropic:claude-sonnet-4-20250514': 'Sonnet 4',
  'anthropic:claude-sonnet-4-5-20250929': 'Sonnet 4.5',
  'anthropic:claude-sonnet-4-5': 'Sonnet 4.5',
  'anthropic:claude-sonnet-4-6': 'Sonnet 4.6',
  'anthropic:claude-opus-4-7': 'Opus 4.7',
};

const AGENT_LABEL: Record<string, string> = {
  categorization: 'Kategorisierung',
  weekly_analysis: 'Wochenanalyse',
  monthly_analysis: 'Monatsanalyse',
  anomaly: 'Anomalie-Erkennung',
  synthesis: 'Synthese',
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `${n}`;
}

function formatCost(usd: string | null | undefined): string {
  if (usd === null || usd === undefined || usd === '') return '—';
  const n = parseFloat(usd);
  if (Number.isNaN(n)) return '—';
  if (n === 0) return '$0';
  if (n < 0.01) return '< $0.01';
  return `$${n.toFixed(n < 1 ? 2 : 2)}`;
}

function RunRow({
  run,
  estimate,
  expanded,
  onToggleExpand,
  onCancel,
  isCancelling,
  onRerun,
  isRerunning,
  rerunError,
}: {
  run: Run;
  estimate: number | null;
  expanded: boolean;
  onToggleExpand: () => void;
  onCancel: () => void;
  isCancelling: boolean;
  onRerun: () => void;
  isRerunning: boolean;
  rerunError: unknown;
  key?: string;
}) {
  const status: RunStatus = run.status;
  const isActive = status === 'running' || status === 'pending';
  const styleClass = STATUS_STYLES[status] ?? FALLBACK_STYLE;
  const label = STATUS_LABEL[status] ?? status;

  const elapsed = useElapsed(run.started_at, isActive);

  // Tick once a minute so the "stale heartbeat" hint flips on without
  // waiting for the next list refetch.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [status]);

  const heartbeatAgeMs =
    status === 'running' && run.heartbeat_at
      ? now - Date.parse(run.heartbeat_at)
      : null;
  const isStale =
    heartbeatAgeMs !== null && heartbeatAgeMs > STALE_HEARTBEAT_MS;

  const finalDuration =
    run.finished_at && run.started_at
      ? Math.round(
          (Date.parse(run.finished_at) - Date.parse(run.started_at)) / 1000,
        )
      : null;

  const durationText = isActive
    ? `${formatDuration(elapsed)}${estimate !== null ? ` / ≈ ${formatDuration(estimate)}` : ''}`
    : finalDuration !== null
      ? `${finalDuration}s`
      : '—';

  const progress = (() => {
    const cur = run.progress_current;
    const tot = run.progress_total;
    if (cur == null || tot == null || tot === 0) return null;
    return { current: cur, total: tot, pct: Math.min(100, Math.round((cur / tot) * 100)) };
  })();

  // Expandable when the run has something interesting to show —
  // a usage breakdown, aggregate tokens, or at least a cost field.
  const hasUsageData =
    run.usage_detail != null ||
    run.input_tokens != null ||
    run.output_tokens != null ||
    run.cost_usd != null;
  const canExpand = !isActive && hasUsageData;

  const usageEntries = run.usage_detail
    ? Object.entries(run.usage_detail)
    : [];

  return (
    <>
      <tr
        className={`hover:bg-surface-container/30 transition-colors ${canExpand ? 'cursor-pointer' : ''}`}
        onClick={canExpand ? onToggleExpand : undefined}
      >
        <td className="w-10 px-2 py-4 align-middle">
          {canExpand && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md hover:bg-white/5 text-on-surface-variant">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
          )}
        </td>
        <td className="px-6 py-4">
          <span className="font-bold text-on-surface text-sm">{run.agent_name}</span>
        </td>
        <td className="px-6 py-4 text-sm text-on-surface-variant">{run.trigger}</td>
        <td className="px-6 py-4 text-sm text-on-surface-variant tabular-nums">
          {formatDate(run.started_at, 'dd.MM.yyyy HH:mm')}
        </td>
        <td className="px-6 py-4 text-sm text-on-surface-variant tabular-nums">
          {durationText}
        </td>
        <td className="px-6 py-4 text-right">
          <div className="inline-flex items-center gap-2 justify-end">
            {status === 'running' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                disabled={isCancelling}
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Run abbrechen"
              >
                {isCancelling ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Ban className="w-3 h-3" />
                )}
                Abbrechen
              </button>
            )}
            {(status === 'failed' || status === 'cancelled') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRerun();
                }}
                disabled={isRerunning}
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Run erneut ausführen — bereits kategorisierte Transaktionen bleiben erhalten"
              >
                {isRerunning ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3" />
                )}
                Rerun
              </button>
            )}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${styleClass}`}
              title={run.error ?? undefined}
            >
              {status === 'running' && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
              {status === 'succeeded' && <CheckCircle2 className="w-3 h-3" />}
              {status === 'failed' && <XCircle className="w-3 h-3" />}
              {status === 'cancelled' && <Ban className="w-3 h-3" />}
              {label}
            </span>
          </div>
        </td>
      </tr>
      {status === 'failed' && run.error && (
        <tr className="bg-error/5 border-l-2 border-error">
          <td colSpan={6} className="px-6 pb-4 pt-0">
            <div className="flex items-start gap-2 text-xs text-error">
              <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                {run.error.split(' | ').map((line, i) => (
                  <p key={i} className="leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
      {rerunError !== null && rerunError !== undefined && (
        <tr className="bg-error/5 border-l-2 border-error" role="alert">
          <td colSpan={6} className="px-6 pb-4 pt-0">
            <div className="flex items-start gap-2 text-xs text-error">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Rerun fehlgeschlagen:{' '}
                {rerunError instanceof Error
                  ? rerunError.message
                  : 'Unbekannter Fehler'}
              </p>
            </div>
          </td>
        </tr>
      )}
      {isActive && (run.progress_message || progress || (status === 'running' && run.last_error) || isStale) && (
        <tr className="bg-surface-container/10">
          <td colSpan={6} className="px-6 pb-4 pt-0 space-y-2">
            {progress && (
              <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
            )}
            <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
              <span className="flex items-center gap-2">
                {run.progress_message ?? 'läuft…'}
                {isStale && heartbeatAgeMs !== null && (
                  <span
                    className="inline-flex items-center gap-1 text-on-surface-variant/70 italic"
                    title={`Letztes Lebenszeichen vor ${Math.floor(heartbeatAgeMs / 60_000)} Min.`}
                  >
                    · stale? ({Math.floor(heartbeatAgeMs / 60_000)}m)
                  </span>
                )}
              </span>
              {progress && (
                <span className="tabular-nums font-bold text-on-surface">
                  {progress.current}/{progress.total} ({progress.pct}%)
                </span>
              )}
            </div>
            {status === 'running' && run.last_error && (
              <div className="flex items-start gap-2 text-[11px] rounded-md border border-amber-400/30 bg-amber-400/10 text-amber-200 px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Letzter Fehler: {run.last_error} — Versuche werden wiederholt
                </p>
              </div>
            )}
          </td>
        </tr>
      )}
      {expanded && canExpand && (
        <tr className="bg-surface-container/20">
          <td colSpan={6} className="px-6 py-4">
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Modellnutzung
              </h4>
              {usageEntries.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-on-surface-variant/70">
                      <th className="text-left font-medium py-1 pr-4">Agent</th>
                      <th className="text-left font-medium py-1 pr-4">Model</th>
                      <th className="text-right font-medium py-1 pr-4">Input</th>
                      <th className="text-right font-medium py-1 pr-4">Output</th>
                      <th className="text-right font-medium py-1">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {usageEntries.map(([agentType, entry]) => (
                      <tr key={agentType}>
                        <td className="py-1.5 pr-4 text-on-surface">
                          {AGENT_LABEL[agentType] ?? agentType}
                        </td>
                        <td className="py-1.5 pr-4 font-mono text-[11px] text-on-surface-variant">
                          {MODEL_LABEL[entry.model] ?? entry.model}
                        </td>
                        <td className="py-1.5 pr-4 text-right tabular-nums text-on-surface-variant">
                          {formatTokens(entry.input_tokens)}
                        </td>
                        <td className="py-1.5 pr-4 text-right tabular-nums text-on-surface-variant">
                          {formatTokens(entry.output_tokens)}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-on-surface font-bold">
                          {formatCost(entry.cost_usd)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-white/10">
                      <td className="pt-2 pr-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Σ Total
                      </td>
                      <td />
                      <td className="pt-2 pr-4 text-right tabular-nums text-on-surface font-bold">
                        {formatTokens(run.input_tokens ?? 0)}
                      </td>
                      <td className="pt-2 pr-4 text-right tabular-nums text-on-surface font-bold">
                        {formatTokens(run.output_tokens ?? 0)}
                      </td>
                      <td className="pt-2 text-right tabular-nums text-primary font-extrabold">
                        {formatCost(run.cost_usd)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div className="text-xs text-on-surface-variant space-y-1">
                  <p>Kein Model-Breakdown verfügbar (älterer Run).</p>
                  <p className="font-mono">
                    Total: {formatTokens(run.input_tokens ?? 0)} in / {formatTokens(run.output_tokens ?? 0)} out · {formatCost(run.cost_usd)}
                  </p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Optional time-window override for the run-trigger. Presets cover the
// common cases (week / month / quarter / year); "Custom" exposes a raw
// number input clamped to the backend's [1, 3650] range. "Standard" sends
// no `period_days` param so the agent's built-in window applies.
type PeriodPreset = 'standard' | 7 | 30 | 90 | 365 | 'custom';

const PERIOD_PRESET_LABEL: Record<Exclude<PeriodPreset, 'custom'>, string> = {
  standard: 'Standard',
  7: '7 Tage',
  30: '30 Tage',
  90: '90 Tage',
  365: '365 Tage',
};

const PERIOD_PRESETS: Exclude<PeriodPreset, 'custom'>[] = [
  'standard',
  7,
  30,
  90,
  365,
];

function PeriodPicker({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  disabled: boolean;
}) {
  // The picker keeps a local "mode" so "Custom" can be selected with an
  // empty input field — once the user types a number we lift it. While
  // mode === 'custom' and the input is blank we still send no override.
  const initialMode: PeriodPreset =
    value === null
      ? 'standard'
      : value === 7 || value === 30 || value === 90 || value === 365
        ? value
        : 'custom';
  const [mode, setMode] = useState<PeriodPreset>(initialMode);
  const [customDraft, setCustomDraft] = useState<string>(
    initialMode === 'custom' && value !== null ? String(value) : '',
  );

  const handleModeChange = (next: PeriodPreset) => {
    setMode(next);
    if (next === 'standard') {
      onChange(null);
    } else if (next === 'custom') {
      const parsed = Number(customDraft);
      onChange(
        customDraft !== '' && Number.isFinite(parsed) && parsed >= 1
          ? Math.min(3650, Math.floor(parsed))
          : null,
      );
    } else {
      onChange(next);
    }
  };

  const handleCustomChange = (raw: string) => {
    setCustomDraft(raw);
    if (raw === '') {
      onChange(null);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1) {
      onChange(null);
      return;
    }
    onChange(Math.min(3650, Math.floor(parsed)));
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 bg-surface-container-low/60 rounded-xl border border-white/5 px-4 py-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
        Zeitraum
      </span>
      <div className="flex flex-wrap gap-1.5">
        {PERIOD_PRESETS.map((preset) => {
          const active = mode === preset;
          return (
            <button
              key={String(preset)}
              type="button"
              onClick={() => handleModeChange(preset)}
              disabled={disabled}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                active
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {PERIOD_PRESET_LABEL[preset]}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => handleModeChange('custom')}
          disabled={disabled}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            mode === 'custom'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Custom
        </button>
      </div>
      {mode === 'custom' && (
        <input
          type="number"
          min={1}
          max={3650}
          step={1}
          inputMode="numeric"
          placeholder="Tage"
          value={customDraft}
          onChange={(e) => handleCustomChange(e.target.value)}
          disabled={disabled}
          aria-label="Zeitraum in Tagen"
          className="w-24 bg-surface-container-lowest px-3 py-1.5 rounded-md text-xs font-bold text-on-surface tabular-nums outline-none border border-transparent focus:border-primary/50 disabled:opacity-50"
        />
      )}
      <span className="text-[10px] text-on-surface-variant ml-auto">
        Wirkt nur auf Wochen-, Monats- und Anomalie-Agent.
      </span>
    </div>
  );
}
