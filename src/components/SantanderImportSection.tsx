import { Upload } from 'lucide-react';
import { useImportSantanderPdf } from '../api/imports';
import FileImportSection, {
  DEFAULT_PDF_MAX_BYTES,
  type FileImportOutcome,
} from './FileImportSection';

export default function SantanderImportSection() {
  const importPdf = useImportSantanderPdf();

  const handleImport = async (files: File[]): Promise<FileImportOutcome> => {
    const res = await importPdf.mutateAsync(files);
    return {
      banner:
        `Import abgeschlossen — ${res.statements} Abrechnung(en), ` +
        `${res.parsed} Transaktion(en) gelesen, ${res.inserted} neu, ` +
        `${res.duplicates} Duplikat(e), ${res.normalized} normalisiert.`,
      warnings: res.errors,
    };
  };

  return (
    <FileImportSection
      icon={Upload}
      title="Santander-Kreditkarte importieren"
      description={
        'Lädt die Monatsabrechnungen der Santander 1plus Visa als PDF hoch. ' +
        'Mehrere Abrechnungen auf einmal möglich; jede wird per ' +
        'Saldo-Abgleich geprüft. Mehrfach-Upload ist unschädlich — ' +
        'Duplikate werden erkannt.'
      }
      accept=".pdf,application/pdf"
      multiple
      allowedTypes={['application/pdf']}
      allowedExtensions={['.pdf']}
      maxBytes={DEFAULT_PDF_MAX_BYTES}
      helpText={
        <>
          Export im MySantander-Online-Banking unter <strong>Postbox</strong>{' '}
          als PDF. Die 1plus Visa ist über PSD2 nicht erreichbar — die
          Monatsabrechnung ist der Weg. Nach dem Import normalisiert k-fin
          automatisch.
        </>
      }
      buttonIdleLabel="PDF-Abrechnungen auswählen"
      buttonBusyLabel="Importiere…"
      onImport={handleImport}
      busy={importPdf.isPending}
    />
  );
}
