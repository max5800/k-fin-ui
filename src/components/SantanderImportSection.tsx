import { Upload, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useImportSantanderPdf } from '../api/imports';

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}

export default function SantanderImportSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultBanner, setResultBanner] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const importPdf = useImportSantanderPdf();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setResultBanner(null);
    setWarnings([]);
    try {
      const res = await importPdf.mutateAsync(Array.from(files));
      setResultBanner(
        `Import abgeschlossen — ${res.statements} Abrechnung(en), ` +
          `${res.parsed} Transaktion(en) gelesen, ${res.inserted} neu, ` +
          `${res.duplicates} Duplikat(e), ${res.normalized} normalisiert.`,
      );
      setWarnings(res.errors);
    } catch (err) {
      setError(extractError(err, 'Import fehlgeschlagen'));
    } finally {
      // Reset the input so re-selecting the same files fires `onChange`.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isUploading = importPdf.isPending;

  return (
    <section className="bg-surface-container-low rounded-2xl border border-white/5 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Upload className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-headline font-bold text-on-surface">
            Santander-Kreditkarte importieren
          </h3>
          <p className="text-xs text-on-surface-variant">
            Lädt die Monatsabrechnungen der Santander 1plus Visa als PDF hoch.
            Mehrere Abrechnungen auf einmal möglich; jede wird per
            Saldo-Abgleich geprüft. Mehrfach-Upload ist unschädlich —
            Duplikate werden erkannt.
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-3 rounded-lg text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50"
        title="Santander-Kreditkartenabrechnungen als PDF hochladen und importieren"
      >
        {isUploading ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        {isUploading ? 'Importiere…' : 'PDF-Abrechnungen auswählen'}
      </button>

      <p className="mt-4 text-[11px] text-on-surface-variant leading-relaxed">
        Export im MySantander-Online-Banking unter <strong>Postbox</strong> als
        PDF. Die 1plus Visa ist über PSD2 nicht erreichbar — die
        Monatsabrechnung ist der Weg. Nach dem Import normalisiert k-fin
        automatisch.
      </p>

      {error && (
        <p className="mt-4 text-xs text-error font-bold" role="alert">
          {error}
        </p>
      )}
      {resultBanner && (
        <p className="mt-4 text-xs text-primary font-bold" role="status">
          {resultBanner}
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {warnings.map((warning, i) => (
            <li key={i} className="text-[11px] text-warning leading-relaxed">
              {warning}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
