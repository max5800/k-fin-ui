import { Bell, ChevronDown, Cloud, KeyRound, Layers, List, LogOut, RefreshCw, Sliders, Smartphone, User, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import {
  useStartSync,
  useNormalizeSync,
  useConfirmSync,
  type SyncProviderInfo,
} from '../api/sync';
import { useSettings, useTestWebhook, useUpdateSettings } from '../api/settings';
import { useChangePassword } from '../api/auth';
import { useEscapeKey } from '../lib/useEscapeKey';
import { tanModalSubtitle, tanModalInstruction } from '../lib/tanInstructions';
import { extractApiError } from '../lib/apiError';
import BackfillSection from './BackfillSection';
import PaypalImportSection from './PaypalImportSection';
import SantanderImportSection from './SantanderImportSection';
import OwnIbansSection from './OwnIbansSection';
import RulesSection from './RulesSection';
import SyncRunsHistory from './SyncRunsHistory';
import TagsSection from './TagsSection';

// Mirrors the backend's PAGE_SIZE_MIN/MAX clamp in
// src/api/routers/settings.py (k-fin) — change there first if you tweak.
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;

// Discord accepts both hostnames as valid webhook bases.
const DISCORD_WEBHOOK_PREFIXES = [
  'https://discord.com/api/webhooks/',
  'https://discordapp.com/api/webhooks/',
];

function isValidDiscordWebhook(url: string): boolean {
  if (url === '') return true;
  return DISCORD_WEBHOOK_PREFIXES.some((p) => url.startsWith(p));
}

// Fallback provider for the TAN modal when the sync-start response carries
// no `provider` block (pre-P2a backends). Routing it through the same
// `tanInstructions` helpers keeps the Comdirect copy in one place instead
// of hardcoding the subtitle + instruction paragraph here.
const COMDIRECT_FALLBACK_PROVIDER: SyncProviderInfo = {
  source: 'comdirect',
  display_name: 'Comdirect',
  tan_kind: 'decoupled_app_push',
  display_hint: 'photoTAN',
};

export default function Settings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const startSync = useStartSync();
  const confirmSync = useConfirmSync();
  const normalize = useNormalizeSync();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const testWebhook = useTestWebhook();
  const changePassword = useChangePassword();
  const [thresholdDraft, setThresholdDraft] = useState<number>(0.6);

  // Discord webhook draft state. The field is optional and the backend
  // currently (Wave-1) doesn't accept it — see handleSaveWebhook for the
  // graceful-degradation path when /settings PUT comes back 422.
  const [webhookDraft, setWebhookDraft] = useState<string>('');
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [webhookBackendMissing, setWebhookBackendMissing] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Change-password form state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      setThresholdDraft(settingsQuery.data.auto_apply_confidence);
      setWebhookDraft(settingsQuery.data.webhook_url ?? '');
    }
  }, [settingsQuery.data]);

  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [syncProvider, setSyncProvider] = useState<SyncProviderInfo | null>(null);
  const [tanError, setTanError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleStart = async () => {
    setTanError(null);
    setLastResult(null);
    try {
      const res = await startSync.mutateAsync();
      setPendingSessionId(res.session_id);
      setSyncProvider(res.provider ?? null);
    } catch (err) {
      setTanError(extractApiError(err, 'Sync konnte nicht gestartet werden'));
    }
  };

  const handleConfirm = async () => {
    if (!pendingSessionId) return;
    setTanError(null);
    try {
      const res = await confirmSync.mutateAsync(pendingSessionId);
      setPendingSessionId(null);
      setSyncProvider(null);
      const ingested = res.ingest?.inserted ?? 0;
      const normalized = res.ingest?.normalized ?? 0;
      setLastResult(
        `Sync abgeschlossen — ${ingested} importiert, ${normalized} normalisiert. ` +
          `Für KI-Kategorisierung: «Agents» öffnen.`,
      );
    } catch (err) {
      setTanError(extractApiError(err, 'Bestätigung fehlgeschlagen'));
    }
  };

  const handleCancel = () => {
    setPendingSessionId(null);
    setSyncProvider(null);
    setTanError(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('kfin_token');
    localStorage.removeItem('kfin_display_name');
    queryClient.clear();
    navigate('/login');
  };

  const handleSaveWebhook = async () => {
    setWebhookError(null);
    setWebhookSaved(false);
    if (!isValidDiscordWebhook(webhookDraft)) {
      setWebhookError(
        'URL muss mit https://discord.com/api/webhooks/ beginnen.',
      );
      return;
    }
    try {
      // Empty string clears the value. Send `null` so the backend can
      // explicitly reset the column rather than save a literal "".
      await updateSettings.mutateAsync({
        webhook_url: webhookDraft === '' ? null : webhookDraft,
      });
      setWebhookSaved(true);
      setWebhookBackendMissing(false);
    } catch (err) {
      // Stream-D-not-yet-deployed path: backend rejects the unknown field
      // with 422. Surface a friendly notice instead of a stack-trace and
      // leave the rest of the settings page fully usable.
      if (isAxiosError(err) && err.response?.status === 422) {
        setWebhookBackendMissing(true);
        return;
      }
      setWebhookError(
        extractApiError(err, 'Webhook konnte nicht gespeichert werden'),
      );
    }
  };

  const handleTestWebhook = async () => {
    setWebhookTestResult(null);
    try {
      const res = await testWebhook.mutateAsync();
      if (res.success) {
        setWebhookTestResult({
          ok: true,
          message: `Test-Send erfolgreich (HTTP ${res.status_code ?? '—'}).`,
        });
      } else {
        setWebhookTestResult({
          ok: false,
          message: res.error
            ? `Discord lehnte ab: ${res.error}`
            : `Discord lehnte ab (HTTP ${res.status_code ?? '—'}).`,
        });
      }
    } catch (err) {
      setWebhookTestResult({
        ok: false,
        message: extractApiError(err, 'Test-Send fehlgeschlagen'),
      });
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (newPw.length < 12) {
      setPwError('Neues Passwort muss mindestens 12 Zeichen haben');
      return;
    }
    try {
      await changePassword.mutateAsync({ current_password: currentPw, new_password: newPw });
      setPwSuccess(true);
      setCurrentPw('');
      setNewPw('');
    } catch (err) {
      setPwError(extractApiError(err, 'Passwort konnte nicht geändert werden'));
    }
  };

  const isSyncing = startSync.isPending;
  const isConfirming = confirmSync.isPending;
  const isNormalizing = normalize.isPending;

  // Escape schließt das TAN-Modal — gesperrt, solange die Bestätigung läuft
  // (gleiches Verhalten wie der Klick auf das Overlay).
  useEscapeKey(!!pendingSessionId && !isConfirming, handleCancel);

  return (
    <div className="pt-28 px-8 pb-12 h-screen overflow-y-auto">
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

        <BackfillSection />

        <PaypalImportSection />

        <SantanderImportSection />

        <SyncRunsHistory />

        <TagsSection />

        <RulesSection />

        <OwnIbansSection />

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
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-on-surface">
                Benachrichtigungen
              </h3>
              <p className="text-xs text-on-surface-variant">
                Optional: Discord-Webhook-URL für Run-Benachrichtigungen.
                Nichts wird ohne Webhook irgendwohin gepusht.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label
              htmlFor="webhook-url"
              className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant"
            >
              Discord Webhook URL
            </label>
            <input
              id="webhook-url"
              type="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://discord.com/api/webhooks/…"
              value={webhookDraft}
              onChange={(e) => {
                setWebhookDraft(e.target.value);
                setWebhookError(null);
                setWebhookSaved(false);
              }}
              disabled={settingsQuery.isPending || updateSettings.isPending}
              className="w-full bg-surface-container-lowest px-4 py-3 rounded-xl text-sm text-on-surface outline-none border border-transparent focus:border-primary/50 transition-all font-mono disabled:opacity-50"
            />
            {webhookError && (
              <p className="text-xs text-error font-bold" role="alert">
                {webhookError}
              </p>
            )}
            {webhookBackendMissing && (
              <p
                className="text-xs text-on-surface-variant italic"
                role="status"
              >
                Backend-Unterstützung folgt — der Server hat das Feld noch
                nicht akzeptiert (HTTP 422). Wert wurde nicht gespeichert.
              </p>
            )}
            {webhookSaved && !webhookError && (
              <p className="text-xs text-primary font-bold" role="status">
                Webhook gespeichert.
              </p>
            )}
            {webhookTestResult && (
              <p
                className={`text-xs font-bold ${
                  webhookTestResult.ok ? 'text-primary' : 'text-error'
                }`}
                role="status"
              >
                {webhookTestResult.message}
              </p>
            )}
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-on-surface-variant">
                Leer lassen zum Deaktivieren. Test-Send sendet eine
                Demo-Nachricht an die gespeicherte URL.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={
                    testWebhook.isPending ||
                    !settingsQuery.data?.webhook_url
                  }
                  title={
                    settingsQuery.data?.webhook_url
                      ? 'Sendet eine Demo-Embed-Nachricht an die gespeicherte URL.'
                      : 'Erst URL speichern, dann testen.'
                  }
                  className="bg-surface-container-high text-on-surface px-3 py-2 rounded-lg text-xs font-bold hover:bg-surface-container-highest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testWebhook.isPending ? 'Sende…' : 'Test-Send'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveWebhook}
                  disabled={
                    updateSettings.isPending ||
                    !settingsQuery.data ||
                    webhookDraft === (settingsQuery.data?.webhook_url ?? '')
                  }
                  className="bg-primary text-on-primary px-4 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {updateSettings.isPending ? 'Speichere…' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-surface-container-low rounded-2xl border border-white/5 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <List className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-on-surface">Anzeige</h3>
              <p className="text-xs text-on-surface-variant">
                Tabellengröße und Seitennavigation. Greift sofort — kein
                Re-Login nötig.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <label
              htmlFor="page-size-select"
              className="text-sm text-on-surface-variant"
            >
              Transaktionen pro Seite
            </label>
            <div className="relative">
              <select
                id="page-size-select"
                value={settingsQuery.data?.page_size ?? 25}
                onChange={(e) =>
                  updateSettings.mutate({ page_size: Number(e.target.value) })
                }
                disabled={settingsQuery.isPending || updateSettings.isPending}
                className="bg-surface-container-lowest pl-4 pr-10 py-2.5 rounded-lg text-sm font-bold text-on-surface border border-transparent hover:border-primary/30 cursor-pointer transition-all appearance-none outline-none tabular-nums disabled:opacity-50"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
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

      {/* Account section */}
      <section className="bg-surface-container-low rounded-2xl border border-white/5 p-6 mt-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-headline font-bold text-on-surface">Konto</h3>
            <p className="text-xs text-on-surface-variant">Passwort ändern</p>
          </div>
        </div>

        <div className="mb-4 text-sm text-on-surface-variant">
          Angemeldet als <span className="text-on-surface font-bold">{localStorage.getItem('kfin_display_name') ?? '—'}</span>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Aktuelles Passwort
            </label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full bg-surface-container-lowest px-4 py-3 rounded-xl text-sm text-on-surface outline-none border border-transparent focus:border-primary/50 transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Neues Passwort <span className="normal-case font-normal">(min. 12 Zeichen)</span>
            </label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              required
              minLength={12}
              className="w-full bg-surface-container-lowest px-4 py-3 rounded-xl text-sm text-on-surface outline-none border border-transparent focus:border-primary/50 transition-all"
            />
          </div>
          {pwError && (
            <p className="text-xs text-error font-bold" role="alert">{pwError}</p>
          )}
          {pwSuccess && (
            <p className="text-xs text-primary font-bold" role="status">Passwort erfolgreich geändert</p>
          )}
          <button
            type="submit"
            disabled={changePassword.isPending}
            className="bg-primary text-on-primary px-6 py-2.5 rounded-xl text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50"
          >
            {changePassword.isPending ? 'Speichere…' : 'Passwort ändern'}
          </button>
        </form>
      </section>

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
              role="dialog"
              aria-modal="true"
              aria-labelledby="tan-confirm-title"
              className="w-full max-w-md bg-surface-container-low border border-white/5 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 id="tan-confirm-title" className="font-headline font-bold text-on-surface">Push-TAN bestätigen</h3>
                    <p className="text-xs text-on-surface-variant">
                      {tanModalSubtitle(
                        syncProvider ?? COMDIRECT_FALLBACK_PROVIDER,
                      )}
                    </p>
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
                {tanModalInstruction(
                  syncProvider ?? COMDIRECT_FALLBACK_PROVIDER,
                )}
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
