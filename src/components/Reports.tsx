import { BarChart3, Download, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useReports, downloadReport } from '../api/reports';
import { formatDate } from '../lib/format';

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Reports() {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const { data: reportsData, isPending } = useReports({ limit: 50 });

  const reports = reportsData?.items || [];
  const activeReport = reports.find((r) => r.id === selectedReportId) || reports[0];

  return (
    <div className="pt-20 h-[calc(100vh-0rem)] flex flex-col md:flex-row bg-surface">
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

      <section className="flex-1 overflow-y-auto bg-surface p-8 lg:p-12">
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
                    Report
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

              <p className="text-sm text-on-surface-variant leading-relaxed">
                Erzeugt am {formatDate(activeReport.created_at, "dd.MM.yyyy 'um' HH:mm")}.
                Lade den Report herunter, um den vollständigen Inhalt einzusehen.
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
