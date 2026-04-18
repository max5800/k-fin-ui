import { Cloud, Layers, LogOut, RefreshCw, Sliders, Smartphone, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { useStartSync, useNormalizeSync, useConfirmSync } from '../api/sync';
import { useSettings, useUpdateSettings } from '../api/settings';

export default function Settings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const startSync = useStartSync();
  const confirmSync = useConfirmSync();
  const normalize = useNormalizeSync();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const [thresholdDraft, setThresholdDraft] = useState<number>(0.6);

  useEffect(() => {
    if (settingsQuery.data) {
      setThresholdDraft(settingsQuery.data.auto_apply_confidence);
    }
  }, [settingsQuery.data]);

  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [tanError, setTanError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleStart = async () => {
    setTanError(null);
    setLastResult(null);
    try {
      const res = await startSync.mutateAsync();
      setPendingSessionId(res.session_id);
    } catch (err) {
      setTanError(extractError(err, 'Sync konnte nicht gestartet werden'));
    }
  };

  const handleConfirm = async () => {
    if (!pendingSessionId) return;
    setTanError(null);
    try {
      const res = await confirmSync.mutateAsync(pendingSessionId);
      setPendingSessionId(null);
      const ingested = res.ingest?.inserted ?? 0;
      const normalized = res.ingest?.normalized ?? 0;
      setLastResult(
        `Sync abgeschlossen — ${ingested} importiert, ${normalized} normalisiert. ` +
          `Für KI-Kategorisierung: «Agents» öffnen.`,
      );
    } catch (err) {
      setTanError(extractError(err, 'Bestätigung fehlgeschlagen'));
    }
  };

  const handleCancel = () => {
    setPendingSessionId(null);
    setTanError(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('kfin_token');
    queryClient.clear();
    navigate('/login');
  };

  const isSyncing = startSync.isPending;
  const isConfirming = confirmSync.isPending;
  const isNormalizing = normalize.isPending;

  return (
    <div className="pt-24 px-8 pb-12 h-screen overflow-y-auto">
      <div className="max-w-3xl space-y-8">
        <header className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-headline font-extrabold text-on-surface tracking-tight">
              Einstellungen
            </h2>
            <p className="text-on-surface-variant text-sm mt-1">
              Konto, Synchronisation und System
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-error/10 text-error rounded-lg text-sm font-bold border border-error/20 hover:bg-error/20 transition-all"
          >
            <LogOut className="w-4 h-4" /> Abmelden
          </button>
        </header>

        <section className="bg-surface-container-low rounded-2xl border border-white/5 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-on-surface">Datenabgleich</h3>
              <p className="text-xs text-on-surface-variant">
                Holt neue Comdirect-Transaktionen und normalisiert sie. Keine
                LLM-Calls — KI-Kategorisierung läuft separat unter «Agents».
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleStart}
              disabled={isSyncing || !!pendingSessionId}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-on-primary py-3 rounded-lg text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50"
              title="Triggert Push-TAN, lädt neue Transaktionen, normalisiert"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Starte…' : 'Sync (Daten holen)'}
            </button>
            <button
              onClick={() => normalize.mutate()}
              disabled={isNormalizing}
              className="flex-1 flex items-center justify-center gap-2 bg-surface-container-high hover:bg-surface-container-highest py-3 rounded-lg text-sm font-bold text-on-surface transition-all disabled:opacity-50"
              title="Re-runs der Normalisierungs-Pipeline über bereits importierte Roh-Daten"
            >
              <Layers className={`w-4 h-4 ${isNormalizing ? 'animate-pulse' : ''}`} />
              {isNormalizing ? 'Normalisiere…' : 'Nur Re-Normalisieren'}
            </button>
          </div>

          <p className="mt-4 text-[11px] text-on-surface-variant leading-relaxed">
            <strong>Sync</strong>: Push-TAN bestätigen → Comdirect-Daten holen →
            Normalisierung (~10–20 s, je nach Anzahl).{' '}
            <strong>Re-Normalisieren</strong>: ohne TAN, nur die letzten Roh-Daten
            erneut durch die Pipeline jagen (z.B. nach Regel-Änderungen).
          </p>

          {tanError && !pendingSessionId && (
            <p className="mt-4 text-xs text-error font-bold" role="alert">
              {tanError}
            </p>
          )}
          {lastResult && (
            <p className="mt-4 text-xs text-primary font-bold">{lastResult}</p>
          )}
        </section>

        <section className="bg-surface-container-low rounded-2xl border border-white/5 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-on-surface">
                Auto-Apply Confidence
              </h3>
              <p className="text-xs text-on-surface-variant">
                Vorschläge mit Confidence ≥ X% werden automatisch übernommen.
                Niedrigere landen im Review.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-on-surface-variant">Schwellenwert</span>
              <span className="text-on-surface font-bold tabular-nums">
                {Math.round(thresholdDraft * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={1}
              step={0.05}
              value={thresholdDraft}
              onChange={(e) => setThresholdDraft(Number(e.target.value))}
              disabled={settingsQuery.isPending || updateSettings.isPending}
              className="w-full accent-primary"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-on-surface-variant">
                {settingsQuery.data &&
                Math.abs(thresholdDraft - settingsQuery.data.auto_apply_confidence) < 1e-9
                  ? 'Aktiv'
                  : 'Ungespeicherte Änderung'}
              </span>
              <button
                onClick={() =>
                  updateSettings.mutate({ auto_apply_confidence: thresholdDraft })
                }
                disabled={
                  updateSettings.isPending ||
                  !settingsQuery.data ||
                  Math.abs(
                    thresholdDraft - (settingsQuery.data?.auto_apply_confidence ?? 0),
                  ) < 1e-9
                }
                className="bg-primary text-on-primary px-4 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50"
              >
                {updateSettings.isPending ? 'Speichere…' : 'Speichern'}
              </button>
            </div>
          </div>
        </section>

        <section className="bg-surface-container-low rounded-2xl border border-white/5 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-on-surface">Profil</h3>
              <p className="text-xs text-on-surface-variant">
                Persönliche Einstellungen
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-on-surface-variant">Sprache</span>
              <span className="text-on-surface font-bold">Deutsch</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-on-surface-variant">Währung</span>
              <span className="text-on-surface font-bold">EUR</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-on-surface-variant">Zeitzone</span>
              <span className="text-on-surface font-bold">Europe/Berlin</span>
            </div>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {pendingSessionId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
            onClick={isConfirming ? undefined : handleCancel}
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
                    <p className="text-xs text-on-surface-variant">Comdirect photoTAN App</p>
                  </div>
                </div>
                <button
                  onClick={handleCancel}
                  disabled={isConfirming}
                  className="text-on-surface-variant hover:text-on-surface disabled:opacity-30"
                  aria-label="Schließen"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                Öffne die Comdirect <span className="font-bold text-on-surface">photoTAN App</span> auf
                deinem Smartphone und bestätige die Anmeldung. Klicke danach unten
                auf &laquo;Bestätigt&raquo; — Comdirect-Daten werden geladen und
                normalisiert (~10–20 s). KI-Kategorisierung startest du danach
                separat unter «Agents».
              </p>

              {tanError && (
                <p className="mb-4 text-xs text-error font-bold text-center" role="alert">
                  {tanError}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
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
                      Lade Daten...
                    </>
                  ) : (
                    'Bestätigt'
                  )}
                </button>
              </div>

              <p className="mt-4 text-[10px] text-on-surface-variant/60 text-center">
                Session: {pendingSessionId.slice(0, 8)}…
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}
