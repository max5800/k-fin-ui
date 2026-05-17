import { Landmark, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { useSettings, useUpdateSettings } from '../api/settings';

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}

// Split the textarea (one IBAN per line, commas tolerated) into a clean list.
function parseIbans(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default function OwnIbansSection() {
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      setDraft(settingsQuery.data.own_ibans.join('\n'));
    }
  }, [settingsQuery.data]);

  const handleSave = async () => {
    setError(null);
    setSaved(false);
    try {
      await updateSettings.mutateAsync({ own_ibans: parseIbans(draft) });
      setSaved(true);
    } catch (err) {
      setError(extractError(err, 'IBANs konnten nicht gespeichert werden'));
    }
  };

  const busy = settingsQuery.isPending || updateSettings.isPending;

  return (
    <section className="bg-surface-container-low rounded-2xl border border-white/5 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Landmark className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-headline font-bold text-on-surface">
            Eigene Konten (IBANs)
          </h3>
          <p className="text-xs text-on-surface-variant">
            Überweisungen zwischen diesen Konten werden als interne Transfers
            erkannt und fallen aus Einnahmen, Ausgaben und Sparquote heraus.
            Eine IBAN pro Zeile.
          </p>
        </div>
      </div>

      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
          setSaved(false);
        }}
        rows={4}
        spellCheck={false}
        placeholder={'DE…\nDE…'}
        disabled={busy}
        className="w-full bg-surface-container-lowest px-4 py-3 rounded-xl text-sm text-on-surface outline-none border border-transparent focus:border-primary/50 transition-all font-mono disabled:opacity-50"
      />

      {error && (
        <p className="mt-3 text-xs text-error font-bold" role="alert">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="mt-3 text-xs text-primary font-bold" role="status">
          Gespeichert.
        </p>
      )}

      <div className="flex justify-end mt-4">
        <button
          onClick={handleSave}
          disabled={busy}
          className="bg-primary text-on-primary px-4 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {updateSettings.isPending && (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          )}
          {updateSettings.isPending ? 'Speichere…' : 'Speichern'}
        </button>
      </div>
    </section>
  );
}
