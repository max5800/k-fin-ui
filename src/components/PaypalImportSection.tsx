import { Upload } from 'lucide-react';
import { useImportPaypalCsv } from '../api/imports';
import FileImportSection, {
  DEFAULT_CSV_MAX_BYTES,
  type FileImportOutcome,
} from './FileImportSection';

export default function PaypalImportSection() {
  const importCsv = useImportPaypalCsv();

  const handleImport = async (files: File[]): Promise<FileImportOutcome> => {
    // The hidden input is single-select, so exactly one file is present.
    const res = await importCsv.mutateAsync(files[0]);
    return {
      banner:
        `Import abgeschlossen — ${res.parsed} Transaktion(en) gelesen, ` +
        `${res.inserted} neu, ${res.duplicates} Duplikat(e), ` +
        `${res.normalized} normalisiert.`,
    };
  };

  return (
    <FileImportSection
      icon={Upload}
      title="PayPal-CSV importieren"
      description={
        'Lädt einen PayPal-Kontoauszug (CSV-Export) hoch. Echte Zahlungen ' +
        'werden importiert, interne Buchungen (Bank-Aufladung, Umrechnung) ' +
        'übersprungen. Mehrfach-Upload ist unschädlich — Duplikate werden ' +
        'erkannt.'
      }
      accept=".csv,text/csv"
      allowedTypes={['text/csv', 'application/csv', 'application/vnd.ms-excel']}
      allowedExtensions={['.csv']}
      maxBytes={DEFAULT_CSV_MAX_BYTES}
      helpText={
        <>
          Export in PayPal unter <strong>Aktivität → Kontoauszüge</strong> als
          CSV. Nach dem Import normalisiert k-fin automatisch — ein
          PayPal-Kauf reichert die zugehörige «PAYPAL»-Buchung im Bankkonto
          mit dem echten Händler an.
        </>
      }
      buttonIdleLabel="CSV-Datei auswählen"
      buttonBusyLabel="Importiere…"
      onImport={handleImport}
      busy={importCsv.isPending}
    />
  );
}
