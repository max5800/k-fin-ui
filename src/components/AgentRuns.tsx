import {
  AlertTriangle,
  Calendar,
  CalendarRange,
  CheckCircle2,
  Loader2,
  Sparkles,
  Tag,
  XCircle,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { ComponentType } from 'react';
import {
  useRuns,
  useTriggerFullPipeline,
  useTriggerRun,
} from '../api/runs';
import { formatDate } from '../lib/format';
import type { AgentName, RunStatus } from '../api/types';

type AgentMeta = {
  id: AgentName;
  name: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
};

const AGENTS: AgentMeta[] = [
  {
    id: 'categorization',
    name: 'Kategorisierung',
    desc: 'Ordnet Transaktionen automatisch Kategorien zu',
    icon: Tag,
  },
  {
    id: 'weekly_analysis',
    name: 'Wochenanalyse',
    desc: 'Wöchentliche Auswertung & Trends',
    icon: CalendarRange,
  },
  {
    id: 'monthly_analysis',
    name: 'Monatsanalyse',
    desc: 'Monatsbericht & Kategorien-Breakdown',
    icon: Calendar,
  },
  {
    id: 'anomaly',
    name: 'Anomalie-Erkennung',
    desc: 'Findet ungewöhnliche Ausgaben & Muster',
    icon: AlertTriangle,
  },
  {
    id: 'synthesis',
    name: 'Synthese',
    desc: 'Aggregiert Ergebnisse zu einer Gesamtschau',
    icon: Sparkles,
  },
];

const STATUS_STYLES: Record<RunStatus, string> = {
  SUCCEEDED: 'bg-secondary/10 text-secondary border-secondary/30',
  RUNNING: 'bg-primary/10 text-primary border-primary/30',
  PENDING: 'bg-surface-container-high text-on-surface-variant border-white/10',
  FAILED: 'bg-error/10 text-error border-error/30',
};

const STATUS_LABEL: Record<RunStatus, string> = {
  SUCCEEDED: 'Erfolgreich',
  RUNNING: 'Läuft',
  PENDING: 'Wartet',
  FAILED: 'Fehlgeschlagen',
};

export default function AgentRuns() {
  const { data: runsData, isPending: isHistoryPending } = useRuns({ limit: 20 });
  const { mutate: triggerRun, isPending: isTriggering, variables: triggeringAgent } =
    useTriggerRun();
  const { mutate: triggerFull, isPending: isTriggeringFull } = useTriggerFullPipeline();

  const hasActiveRun = runsData?.items.some(
    (r) => r.status === 'PENDING' || r.status === 'RUNNING',
  );

  return (
    <div className="pt-24 px-8 pb-12 overflow-y-auto h-screen">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h3 className="text-on-surface-variant text-xs uppercase tracking-[0.2em] font-bold mb-1">
            AI-Pipelines
          </h3>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight">Agents</h1>
        </div>
        {hasActiveRun && (
          <div className="flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-full border border-primary/20">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium text-on-surface-variant uppercase tracking-widest">
              Auto-Refresh aktiv (5s)
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6 mb-12">
        <div className="col-span-12 lg:col-span-4">
          <button
            onClick={() => triggerFull()}
            disabled={isTriggeringFull || isTriggering}
            className="w-full h-full flex flex-col justify-center items-center p-8 bg-surface-container-highest rounded-2xl border-2 border-secondary relative overflow-hidden group transition-all hover:shadow-[0_0_40px_rgba(244,189,95,0.1)] disabled:opacity-50"
          >
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
          </button>
        </div>

        <div className="col-span-12 lg:col-span-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            const isThisTriggering = isTriggering && triggeringAgent === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => triggerRun(agent.id)}
                disabled={isTriggering || isTriggeringFull}
                className="flex flex-col p-5 bg-surface-container rounded-xl border border-white/5 hover:bg-surface-container-high hover:-translate-y-0.5 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  {isThisTriggering ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span className="font-bold text-on-surface mb-1">{agent.name}</span>
                <span className="text-xs text-on-surface-variant leading-relaxed">
                  {agent.desc}
                </span>
              </button>
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
                    <td colSpan={5} className="px-6 py-4">
                      <div className="h-8 bg-white/5 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : runsData?.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-16 text-on-surface-variant text-sm"
                  >
                    Noch keine Runs — starte oben einen Agent
                  </td>
                </tr>
              ) : (
                runsData?.items.map((run) => {
                  const status = run.status as RunStatus;
                  const duration =
                    run.finished_at && run.started_at
                      ? Math.round(
                          (new Date(run.finished_at).getTime() -
                            new Date(run.started_at).getTime()) /
                            1000,
                        )
                      : null;
                  return (
                    <tr
                      key={run.id}
                      className="hover:bg-surface-container/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="font-bold text-on-surface text-sm">
                          {run.agent_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">
                        {run.trigger}
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant tabular-nums">
                        {formatDate(run.started_at, 'dd.MM.yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant tabular-nums">
                        {duration !== null ? `${duration}s` : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${STATUS_STYLES[status]}`}
                        >
                          {status === 'RUNNING' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          )}
                          {status === 'SUCCEEDED' && <CheckCircle2 className="w-3 h-3" />}
                          {status === 'FAILED' && <XCircle className="w-3 h-3" />}
                          {STATUS_LABEL[status]}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
