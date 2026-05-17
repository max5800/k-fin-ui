import { Upload, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useImportPaypalCsv } from '../api/imports';

function extractError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}

export default function PaypalImportSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultBanner, setResultBanner] = useState<string | null>(null);
  const importCsv = useImportPaypalCsv();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResultBanner(null);
    try {
      const res = await importCsv.mutateAsync(file);
      setResultBanner(
        `Import abgeschlossen — ${res.parsed} Transaktion(en) gelesen, ` +
          `${res.inserted} neu, ${res.duplicates} Duplikat(e), ` +
          `${res.normalized} normalisiert.`,
      );
    } catch (err) {
      setError(extractError(err, 'Import fehlgeschlagen'));
    } finally {
      // Reset the input so re-selecting the same file fires `onChange`.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isUploading = importCsv.isPending;

  return (
    <section className="bg-surface-container-low rounded-2xl border border-white/5 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Upload className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-headline font-bold text-on-surface">
            PayPal-CSV importieren
          </h3>
          <p className="text-xs text-on-surface-variant">
            Lädt einen PayPal-Kontoauszug (CSV-Export) hoch. Echte Zahlungen
            werden importiert, interne Buchungen (Bank-Aufladung, Umrechnung)
            übersprungen. Mehrfach-Upload ist unschädlich — Duplikate werden
            erkannt.
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-3 rounded-lg text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50"
        title="PayPal-Kontoauszug als CSV hochladen und importieren"
      >
        {isUploading ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        {isUploading ? 'Importiere…' : 'CSV-Datei auswählen'}
      </button>

      <p className="mt-4 text-[11px] text-on-surface-variant leading-relaxed">
        Export in PayPal unter <strong>Aktivität → Kontoauszüge</strong> als
        CSV. Nach dem Import normalisiert k-fin automatisch — ein PayPal-Kauf
        reichert die zugehörige «PAYPAL»-Buchung im Bankkonto mit dem echten
        Händler an.
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
    </section>
  );
}
