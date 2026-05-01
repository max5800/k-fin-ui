import { History, Smartphone, X, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { isAxiosError } from 'axios';
import {
  useStartBackfill,
  useConfirmBackfill,
  useBackfillRun,
  type BackfillRunResponse,
} from '../api/sync';

const MONTH_OPTIONS = [3, 6, 12, 18, 24] as const;

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

function progressPercent(run: BackfillRunResponse | undefined): number {
  if (!run || run.windows_total <= 0) return 0;
  // Cap at 100 because halvings inflate the actual count past total.
  return Math.min(100, Math.round((run.windows_done / run.windows_total) * 100));
}

export default function BackfillSection() {
  const [months, setMonths] = useState<number>(24);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultBanner, setResultBanner] = useState<string | null>(null);

  const startBackfill = useStartBackfill();
  const confirmBackfill = useConfirmBackfill();
  const runQuery = useBackfillRun(activeRunId);

  // When a run hits a terminal state, surface the result and clear the
  // active run so the section is ready for another go.
  useEffect(() => {
    const run = runQuery.data;
    if (!run || run.status === 'running') return;
    if (run.status === 'succeeded') {
      setResultBanner(
        `Backfill abgeschlossen — ${run.rows_inserted} neue Transaktionen, ` +
          `${run.windows_done} Fenster.`,
      );
    } else if (run.status === 'failed') {
      setResultBanner(`Backfill fehlgeschlagen: ${run.error ?? 'Unbekannter Fehler'}`);
    } else if (run.status === 'cancelled') {
      setResultBanner('Backfill abgebrochen.');
    }
  }, [runQuery.data]);

  const handleStart = async () => {
    setError(null);
    setResultBanner(null);
    try {
      const res = await startBackfill.mutateAsync(months);
      setPendingSessionId(res.session_id);
    } catch (err) {
      setError(extractError(err, 'Backfill konnte nicht gestartet werden'));
    }
  };

  const handleConfirm = async () => {
    if (!pendingSessionId) return;
    setError(null);
    try {
      const res = await confirmBackfill.mutateAsync(pendingSessionId);
      setPendingSessionId(null);
      setActiveRunId(res.run_id);
      setProgressOpen(true);
    } catch (err) {
      setError(extractError(err, 'Bestätigung fehlgeschlagen'));
    }
  };

  const handleCancelTan = () => {
    setPendingSessionId(null);
    setError(null);
  };

  const handleCloseProgress = () => {
    // Closing the modal does NOT cancel the run — it keeps running on the
    // worker. We just stop showing the modal; the result banner appears
    // when the polling sees a terminal state.
    setProgressOpen(false);
  };

  const isStarting = startBackfill.isPending;
  const isConfirming = confirmBackfill.isPending;
  const run = runQuery.data;
  const isRunning = run?.status === 'running';

  return (
    <>
      <section className="bg-surface-container-low rounded-2xl border border-white/5 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-headline font-bold text-on-surface">Historie nachladen</h3>
            <p className="text-xs text-on-surface-variant">
              Lädt rückwirkend Konto-Transaktionen aus den letzten N Monaten
              (max. 24). Push-TAN wird einmal pro Run benötigt; danach läuft
              der Job im Hintergrund.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-on-surface-variant min-w-[80px]">Zeitraum</span>
            <div className="flex flex-wrap gap-2">
              {MONTH_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMonths(m)}
                  disabled={isStarting || !!pendingSessionId || isRunning}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${
                    months === m
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                  }`}
                >
                  {m} Monate
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={isRunning ? () => setProgressOpen(true) : handleStart}
            disabled={isStarting || !!pendingSessionId}
            className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-3 rounded-lg text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50"
            title="Triggert Push-TAN, lädt Historie für den gewählten Zeitraum"
          >
            <RefreshCw className={`w-4 h-4 ${isStarting || isRunning ? 'animate-spin' : ''}`} />
            {isStarting
              ? 'Starte…'
              : isRunning
              ? 'Backfill läuft — Fortschritt anzeigen'
              : 'Historie nachladen'}
          </button>
        </div>

        {error && !pendingSessionId && (
          <p className="mt-4 text-xs text-error font-bold" role="alert">
            {error}
          </p>
        )}
        {resultBanner && (
          <p
            className={`mt-4 text-xs font-bold ${
              run?.status === 'succeeded' ? 'text-primary' : 'text-error'
            }`}
            role="status"
          >
            {resultBanner}
          </p>
        )}
      </section>

      {/* TAN-Modal */}
      <AnimatePresence>
        {pendingSessionId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
            onClick={isConfirming ? undefined : handleCancelTan}
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
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-on-surface">Push-TAN bestätigen</h3>
                    <p className="text-xs text-on-surface-variant">Backfill für {months} Monate</p>
                  </div>
                </div>
                <button
                  onClick={handleCancelTan}
                  disabled={isConfirming}
                  className="text-on-surface-variant hover:text-on-surface disabled:opacity-30"
                  aria-label="Schließen"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                Bestätige die Anmeldung in der Comdirect{' '}
                <span className="font-bold text-on-surface">photoTAN App</span>.
                Nach «Bestätigt» läuft der Backfill als Hintergrund-Job — dauert
                je nach Zeitraum 1–10&nbsp;Minuten. Du kannst das Fenster
                schließen, der Job läuft weiter.
              </p>

              {error && (
                <p className="mb-4 text-xs text-error font-bold text-center" role="alert">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleCancelTan}
                  disabled={isConfirming}
                  className="flex-1 bg-surface-container-high hover:bg-surface-container-highest py-3 rounded-xl text-sm font-bold text-on-surface transition-all disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isConfirming}
                  className="flex-1 bg-primary text-on-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {isConfirming ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Starte Backfill…
                    </>
                  ) : (
                    'Bestätigt'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress-Modal */}
      <AnimatePresence>
        {progressOpen && activeRunId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
            onClick={handleCloseProgress}
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
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      run?.status === 'succeeded'
                        ? 'bg-primary/10 text-primary'
                        : run?.status === 'failed'
                        ? 'bg-error/10 text-error'
                        : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {run?.status === 'succeeded' ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : run?.status === 'failed' ? (
                      <AlertCircle className="w-5 h-5" />
                    ) : (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-on-surface">
                      {run?.status === 'succeeded'
                        ? 'Backfill abgeschlossen'
                        : run?.status === 'failed'
                        ? 'Backfill fehlgeschlagen'
                        : 'Backfill läuft'}
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Ziel-Datum: {run ? formatDate(run.target_start_date) : '—'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseProgress}
                  className="text-on-surface-variant hover:text-on-surface"
                  aria-label="Schließen"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {run ? (
                <>
                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-on-surface-variant mb-2">
                      <span>
                        Fenster {run.windows_done}
                        {run.windows_total > 0 ? ` / ${run.windows_total}` : ''}
                      </span>
                      <span className="tabular-nums">{progressPercent(run)}%</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          run.status === 'failed' ? 'bg-error' : 'bg-primary'
                        }`}
                        style={{ width: `${progressPercent(run)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between border-b border-white/5 py-2">
                      <span className="text-on-surface-variant">Importiert</span>
                      <span className="text-on-surface font-bold tabular-nums">
                        {run.rows_inserted}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 py-2">
                      <span className="text-on-surface-variant">Aktuelles Fenster</span>
                      <span className="text-on-surface font-bold tabular-nums">
                        {formatDate(run.current_window_start)}
                      </span>
                    </div>
                    {run.progress_message && (
                      <p className="text-[11px] text-on-surface-variant/80 pt-2 break-all">
                        {run.progress_message}
                      </p>
                    )}
                    {run.error && (
                      <p className="text-xs text-error font-bold pt-2" role="alert">
                        {run.error}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-on-surface-variant">Lade Status…</p>
              )}

              <p className="mt-6 text-[11px] text-on-surface-variant/60 text-center">
                {run?.status === 'running'
                  ? 'Du kannst dieses Fenster schließen — der Job läuft weiter.'
                  : 'Schließe das Fenster, um zur Übersicht zurückzukehren.'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
