import { AlertTriangle, Database, FlaskConical, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useDevSeed, useDevStatus, useDevWipe } from '../api/dev';

type ConfirmTarget = 'wipe' | 'seed' | null;

// Banking app rule: every destructive action gets a typed confirmation,
// never a bare "Are you sure?" — the friction prevents an absent-minded
// click during a real-data session.
function ConfirmDialog(props: {
  open: boolean;
  title: string;
  body: string;
  expectedPhrase: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [phrase, setPhrase] = useState('');
  if (!props.open) return null;
  const matches = phrase.trim() === props.expectedPhrase;
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface-container-low border border-error/40 rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-error" />
          <h3 className="text-lg font-headline font-bold">{props.title}</h3>
        </div>
        <p className="text-sm text-on-surface-variant mb-4">{props.body}</p>
        <label className="text-xs text-on-surface-variant block mb-2">
          Tippe <code className="font-mono text-error">{props.expectedPhrase}</code> zum Bestätigen:
        </label>
        <input
          type="text"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          autoFocus
          className="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-sm font-mono mb-4 focus:outline-none focus:border-error/60"
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => {
              setPhrase('');
              props.onCancel();
            }}
            className="px-4 py-2 rounded-lg text-sm bg-surface-container-high hover:bg-surface-container-highest"
          >
            Abbrechen
          </button>
          <button
            disabled={!matches || props.loading}
            onClick={() => {
              setPhrase('');
              props.onConfirm();
            }}
            className="px-4 py-2 rounded-lg text-sm bg-error text-on-error font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {props.loading ? 'Läuft…' : 'Ausführen'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DevTools() {
  const status = useDevStatus();
  const wipe = useDevWipe();
  const seed = useDevSeed();
  const [confirm, setConfirm] = useState<ConfirmTarget>(null);

  // Render-side guard: if the backend reports tools off, the page itself
  // doesn't exist. Direct URL access redirects to the Dashboard.
  if (status.isLoading) {
    return <div className="p-8 text-on-surface-variant">Lade…</div>;
  }
  if (!status.data?.enabled) {
    return <Navigate to="/" replace />;
  }

  const wipeResult = wipe.data;
  const seedResult = seed.data;
  const lastError = wipe.error || seed.error;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <FlaskConical className="w-7 h-7 text-warning" />
        <h1 className="text-2xl font-headline font-bold">Dev Tools</h1>
      </div>
      <p className="text-sm text-on-surface-variant mb-8">
        Nur auf der Dev-Stage verfügbar. Diese Aktionen verändern die Datenbank
        sofort und unwiederbringlich. Keine echten Bankdaten hier ablegen.
      </p>

      {lastError ? (
        <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/30 text-sm text-error">
          {lastError instanceof Error ? lastError.message : String(lastError)}
        </div>
      ) : null}

      <div className="space-y-4">
        <section className="bg-surface-container-low rounded-2xl p-6 border border-white/5">
          <div className="flex items-start gap-4 mb-3">
            <Trash2 className="w-5 h-5 mt-0.5 text-error" />
            <div className="flex-1">
              <h2 className="font-headline font-bold mb-1">Transaktionen leeren</h2>
              <p className="text-sm text-on-surface-variant">
                Truncated: <code className="text-xs">raw_transactions</code>,{' '}
                <code className="text-xs">normalized_transactions</code>,{' '}
                <code className="text-xs">transaction_tags</code>,{' '}
                <code className="text-xs">recurring_patterns</code>,{' '}
                <code className="text-xs">agent_runs</code>,{' '}
                <code className="text-xs">sync_runs</code>,{' '}
                <code className="text-xs">backfill_runs</code>,{' '}
                <code className="text-xs">reports</code>,{' '}
                <code className="text-xs">reviewed_suggestions</code>.
                <br />
                Behalten: Kategorien, Budgets, User, Settings, Depots, Positions.
              </p>
            </div>
          </div>
          <button
            onClick={() => setConfirm('wipe')}
            disabled={wipe.isPending}
            className="bg-error text-on-error px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            Wipe ausführen
          </button>
          {wipeResult ? (
            <div className="mt-4 text-xs text-on-surface-variant">
              Letzter Wipe: {wipeResult.transaction_count_before} →{' '}
              {wipeResult.transaction_count_after} Transaktionen.
            </div>
          ) : null}
        </section>

        <section className="bg-surface-container-low rounded-2xl p-6 border border-white/5">
          <div className="flex items-start gap-4 mb-3">
            <Database className="w-5 h-5 mt-0.5 text-primary" />
            <div className="flex-1">
              <h2 className="font-headline font-bold mb-1">Mock-Daten einspielen</h2>
              <p className="text-sm text-on-surface-variant">
                ~150 fiktive Transaktionen über die letzten 6 Monate, inkl.
                Gehalt, Miete, REWE/EDEKA, Apotheke + Krankenkasse-Erstattung,
                Splitwise-Ausgleich, Steuerrückzahlung, Umbuchung, ein
                Outlier-Kauf. Kategorien-Bestand muss vorhanden sein.
              </p>
            </div>
          </div>
          <button
            onClick={() => setConfirm('seed')}
            disabled={seed.isPending}
            className="bg-primary text-on-primary px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            Seed einspielen
          </button>
          {seedResult ? (
            <div className="mt-4 text-xs text-on-surface-variant space-y-0.5">
              <div>
                Letzter Seed: {seedResult.inserted_transactions} Transaktionen,{' '}
                {seedResult.period_start} bis {seedResult.period_end}.
              </div>
              <div>
                Refunds: {seedResult.refund_count} · Umbuchungen:{' '}
                {seedResult.internal_transfer_count} · Outlier:{' '}
                {seedResult.outlier_count}.
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <ConfirmDialog
        open={confirm === 'wipe'}
        title="Wipe bestätigen"
        body="Alle Transaktionen, Agent-Runs, Sync-Runs und Reports werden gelöscht."
        expectedPhrase="WIPE"
        loading={wipe.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          try {
            await wipe.mutateAsync();
          } finally {
            setConfirm(null);
          }
        }}
      />

      <ConfirmDialog
        open={confirm === 'seed'}
        title="Seed bestätigen"
        body="Fügt ~150 fake Transaktionen ein. Bestehende Daten bleiben — vorher ggf. wipen."
        expectedPhrase="SEED"
        loading={seed.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          try {
            await seed.mutateAsync();
          } finally {
            setConfirm(null);
          }
        }}
      />
    </div>
  );
}
