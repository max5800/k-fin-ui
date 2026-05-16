import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  FileText,
  Info,
  ListChecks,
  Sparkles,
  Tag,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useReports, downloadReport } from '../api/reports';
import { formatDate } from '../lib/format';
import type {
  AnalysisContent,
  AnomalyContent,
  CategorizationContent,
  ObservationContent,
  Report,
  SynthesisContent,
} from '../api/types';

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const REPORT_TYPE_LABEL: Record<string, string> = {
  categorization: 'Kategorisierung',
  weekly_analysis: 'Wochenanalyse',
  monthly_analysis: 'Monatsanalyse',
  anomaly: 'Anomalien',
  synthesis: 'Synthese',
};

const SEVERITY_STYLES: Record<string, { badge: string; icon: typeof Info }> = {
  alert: {
    badge: 'bg-error/10 text-error border-error/30',
    icon: AlertTriangle,
  },
  warning: {
    badge: 'bg-warning/10 text-warning border-warning/30',
    icon: AlertTriangle,
  },
  info: {
    badge: 'bg-secondary/10 text-secondary border-secondary/30',
    icon: Info,
  },
};

// Transactions are shown as 8-char prefixes — full UUIDs are too noisy.
// The link target keeps the full ID so the Transactions page can match it
// once the filter contract supports it.
function shortTxId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function ObservationCard({ obs }: { obs: ObservationContent; key?: number }) {
  const sev = SEVERITY_STYLES[obs.severity] ?? SEVERITY_STYLES.info;
  const SevIcon = sev.icon;
  return (
    <div className="rounded-xl border border-white/5 bg-surface-container-low p-5 space-y-3">
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border shrink-0 ${sev.badge}`}
        >
          <SevIcon className="w-3 h-3" />
          {obs.severity}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-1">
            {obs.category}
          </p>
          <p className="text-sm text-on-surface leading-relaxed">{obs.summary}</p>
        </div>
      </div>
      {obs.transaction_ids.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-[88px]">
          {obs.transaction_ids.map((id) => (
            <Link
              key={id}
              to={`/transactions?id=${id}`}
              className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 text-on-surface-variant hover:bg-white/10 hover:text-on-surface transition-colors"
              title={id}
            >
              {shortTxId(id)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CategorizationView({ content }: { content: CategorizationContent }) {
  const lowConf = content.suggestions.filter(
    (s) => s.confidence < 0.6,
  );
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-1 p-1 bg-white/5 rounded-2xl">
        <div className="bg-surface-container-low p-5 rounded-xl">
          <dt className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
            Offen
          </dt>
          <dd className="text-2xl font-headline font-extrabold text-on-surface tabular-nums">
            {content.uncategorized_count}
          </dd>
        </div>
        <div className="bg-surface-container-low p-5 rounded-xl">
          <dt className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
            High-Confidence
          </dt>
          <dd className="text-2xl font-headline font-extrabold text-secondary tabular-nums">
            {content.high_confidence_count}
          </dd>
        </div>
        <div className="bg-surface-container-low p-5 rounded-xl">
          <dt className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
            Review
          </dt>
          <dd className="text-2xl font-headline font-extrabold text-primary tabular-nums">
            {lowConf.length}
          </dd>
        </div>
      </div>
      <Link
        to="/review"
        className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"
      >
        <Tag className="w-3.5 h-3.5" />
        Zur Review-Seite
      </Link>
    </div>
  );
}

function AnalysisView({
  content,
  icon: Icon,
}: {
  content: AnalysisContent;
  icon: typeof TrendingUp;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Icon className="w-4 h-4" />
          </div>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Zusammenfassung
          </h2>
        </div>
        <p className="text-base text-on-surface leading-relaxed">
          {content.summary_text}
        </p>
      </div>
      {content.observations.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Beobachtungen ({content.observations.length})
          </h3>
          {content.observations.map((obs, i) => (
            <ObservationCard key={i} obs={obs} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant italic">
          Keine Beobachtungen erfasst.
        </p>
      )}
    </div>
  );
}

function AnomalyView({ content }: { content: AnomalyContent }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-1 p-1 bg-white/5 rounded-2xl">
        <div className="bg-surface-container-low p-5 rounded-xl">
          <dt className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
            Anomalien
          </dt>
          <dd className="text-2xl font-headline font-extrabold text-on-surface tabular-nums">
            {content.total_anomalies}
          </dd>
        </div>
        <div className="bg-surface-container-low p-5 rounded-xl">
          <dt className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
            Neue Gegenparteien
          </dt>
          <dd className="text-2xl font-headline font-extrabold text-on-surface tabular-nums">
            {content.new_counterparties.length}
          </dd>
        </div>
      </div>
      {content.new_counterparties.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-surface-container-low p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
            Neue Gegenparteien
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {content.new_counterparties.map((name) => (
              <span
                key={name}
                className="text-xs px-2.5 py-1 rounded-md bg-white/5 text-on-surface"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
      {content.anomalies.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Bewertung ({content.anomalies.length})
          </h3>
          {content.anomalies.map((obs, i) => (
            <ObservationCard key={i} obs={obs} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant italic">
          Keine Anomalien gemeldet.
        </p>
      )}
    </div>
  );
}

function SynthesisView({ content }: { content: SynthesisContent }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-secondary">
            Executive Summary
          </h2>
        </div>
        <p className="text-base text-on-surface leading-relaxed whitespace-pre-line">
          {content.executive_summary}
        </p>
      </div>
      {content.key_observations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Kernbeobachtungen
          </h3>
          {content.key_observations.map((obs, i) => (
            <ObservationCard key={i} obs={obs} />
          ))}
        </div>
      )}
      {content.action_items.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-surface-container-low p-5">
          <div className="flex items-center gap-2 mb-4">
            <ListChecks className="w-4 h-4 text-primary" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Action Items
            </h3>
          </div>
          <ul className="space-y-2">
            {content.action_items.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm text-on-surface leading-relaxed"
              >
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReportContentView({ report }: { report: Report }) {
  if (report.content === null) {
    return (
      <p className="text-sm text-on-surface-variant leading-relaxed">
        Erzeugt am {formatDate(report.created_at, "dd.MM.yyyy 'um' HH:mm")}.
        Lade den Report herunter, um den vollständigen Inhalt einzusehen.
      </p>
    );
  }
  switch (report.report_type) {
    case 'categorization':
      return (
        <CategorizationView content={report.content as CategorizationContent} />
      );
    case 'weekly_analysis':
      return (
        <AnalysisView
          content={report.content as AnalysisContent}
          icon={TrendingUp}
        />
      );
    case 'monthly_analysis':
      return (
        <AnalysisView
          content={report.content as AnalysisContent}
          icon={BarChart3}
        />
      );
    case 'anomaly':
      return <AnomalyView content={report.content as AnomalyContent} />;
    case 'synthesis':
      return <SynthesisView content={report.content as SynthesisContent} />;
    default:
      return (
        <pre className="text-xs font-mono p-5 rounded-xl bg-surface-container-low text-on-surface-variant overflow-x-auto">
          {JSON.stringify(report.content, null, 2)}
        </pre>
      );
  }
}

export default function Reports() {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const { data: reportsData, isPending } = useReports({ limit: 50 });

  const reports = reportsData?.items || [];
  const activeReport = reports.find((r) => r.id === selectedReportId) || reports[0];

  return (
    <div className="pt-28 h-screen flex flex-col md:flex-row bg-background">
      <section className="w-full md:w-[380px] bg-surface-container-low border-r border-white/5 overflow-y-auto">
        <div className="p-6 sticky top-0 bg-surface-container-low/90 backdrop-blur-md z-10 border-b border-white/5">
          <h3 className="font-headline font-bold text-on-surface">Alle Reports</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            {reports.length} {reports.length === 1 ? 'Bericht' : 'Berichte'}
          </p>
        </div>

        <div className="px-3 py-4 pb-24 space-y-1">
          {isPending ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-white/5 animate-pulse h-24"
              />
            ))
          ) : reports.length === 0 ? (
            <div className="text-center py-20 opacity-40">
              <FileText className="w-12 h-12 mx-auto mb-4" />
              <p className="font-bold text-xs uppercase tracking-widest">
                Noch keine Reports
              </p>
              <p className="text-[10px] mt-2 px-4 leading-relaxed">
                Starte einen Agent-Run, um den ersten Report zu generieren.
              </p>
            </div>
          ) : (
            reports.map((report) => {
              const isActive = activeReport?.id === report.id;
              return (
                <button
                  key={report.id}
                  onClick={() => setSelectedReportId(report.id)}
                  className={`w-full text-left p-4 rounded-xl transition-all border-l-2 ${
                    isActive
                      ? 'bg-surface-container-high border-primary'
                      : 'hover:bg-surface-container-high/50 border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-on-surface truncate">
                        {report.title}
                      </h4>
                      <p className="text-[10px] text-on-surface-variant mt-1 tabular-nums">
                        {formatDate(report.created_at, 'dd.MM.yyyy')}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="flex-1 overflow-y-auto bg-background p-8 lg:p-12">
        <div className="max-w-3xl mx-auto">
          {activeReport ? (
            <motion.div
              key={activeReport.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-start justify-between gap-6 mb-10">
                <div className="min-w-0">
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-3">
                    {REPORT_TYPE_LABEL[activeReport.report_type] ?? 'Report'}
                  </p>
                  <h1 className="text-3xl lg:text-4xl font-headline font-black text-on-surface tracking-tight leading-tight">
                    {activeReport.title}
                  </h1>
                </div>
                <button
                  onClick={() => downloadReport(activeReport.id)}
                  className="flex items-center gap-2 px-5 py-3 bg-primary text-on-primary font-bold rounded-lg text-sm hover:brightness-110 transition-all shrink-0"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>

              <dl className="grid grid-cols-2 md:grid-cols-4 gap-1 p-1 bg-white/5 rounded-2xl mb-10">
                <div className="bg-surface-container-low p-5 rounded-xl">
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                    Zeitraum
                  </dt>
                  <dd className="text-sm font-bold text-on-surface tabular-nums">
                    {formatDate(activeReport.period_start, 'dd.MM.yy')} –{' '}
                    {formatDate(activeReport.period_end, 'dd.MM.yy')}
                  </dd>
                </div>
                <div className="bg-surface-container-low p-5 rounded-xl">
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                    Format
                  </dt>
                  <dd className="text-sm font-bold text-on-surface uppercase">
                    {activeReport.format}
                  </dd>
                </div>
                <div className="bg-surface-container-low p-5 rounded-xl">
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                    Größe
                  </dt>
                  <dd className="text-sm font-bold text-on-surface tabular-nums">
                    {formatBytes(activeReport.size_bytes)}
                  </dd>
                </div>
                <div className="bg-surface-container-low p-5 rounded-xl">
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                    Status
                  </dt>
                  <dd className="text-sm font-bold text-on-surface uppercase">
                    {activeReport.status}
                  </dd>
                </div>
              </dl>

              {activeReport.error && (
                <div className="p-5 bg-error/10 border border-error/30 rounded-xl mb-8">
                  <p className="text-xs font-bold uppercase tracking-widest text-error mb-2">
                    Fehler
                  </p>
                  <p className="text-sm text-on-surface">{activeReport.error}</p>
                </div>
              )}

              <ReportContentView report={activeReport} />

              <p className="text-xs text-on-surface-variant/70 leading-relaxed mt-10">
                Erzeugt am {formatDate(activeReport.created_at, "dd.MM.yyyy 'um' HH:mm")}.
              </p>
            </motion.div>
          ) : (
            <div className="h-[60vh] flex flex-col items-center justify-center opacity-30">
              <FileText className="w-16 h-16 mb-4" />
              <p className="text-sm font-bold uppercase tracking-widest">
                Report auswählen
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
