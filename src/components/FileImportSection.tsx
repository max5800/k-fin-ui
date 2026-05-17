import { RefreshCw, type LucideIcon } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { extractApiError } from '../lib/apiError';

// Shared scaffold for the statement-import sections (PayPal CSV, Santander
// PDF). Captures the duplicated UI — icon tile + headline + description,
// hidden file input + trigger button, error/result/warnings banners,
// input-reset-in-finally — plus client-side file validation so a
// mis-selected or oversized file never reaches the backend.

// Default per-file size caps. CSV exports stay small; statement PDFs are
// larger but still bounded. Callers may override via props.
export const DEFAULT_CSV_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const DEFAULT_PDF_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

// Outcome of a successful import — the banner string plus optional
// per-file warnings (a partial import skips bad files, not fatal).
export interface FileImportOutcome {
  banner: string;
  warnings?: string[];
}

export interface FileImportSectionProps {
  /** lucide-react icon for the section tile and idle button. */
  icon: LucideIcon;
  title: string;
  description: string;
  /** `accept` attribute for the hidden file input, e.g. '.csv,text/csv'. */
  accept: string;
  /** Allow selecting more than one file. */
  multiple?: boolean;
  /** Footnote rendered under the trigger button. */
  helpText: ReactNode;
  buttonIdleLabel: string;
  buttonBusyLabel: string;
  /** Runs the actual upload once files pass client-side validation. */
  onImport: (files: File[]) => Promise<FileImportOutcome>;
  /** Mutation pending flag from the caller's import hook. */
  busy: boolean;
  /** Per-file size cap in bytes. Defaults to 10 MB. */
  maxBytes?: number;
  /**
   * Accepted MIME types and file extensions for client-side validation.
   * Extensions are matched case-insensitively, with the leading dot.
   */
  allowedTypes?: string[];
  allowedExtensions?: string[];
  /** data-testid forwarded to the section element (optional). */
  testId?: string;
}

/** Human-readable MB for an error message. */
function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/**
 * Validate the selected files against the size cap and content-type /
 * extension whitelist. Returns a German error string, or null when every
 * file is acceptable.
 */
function validateFiles(
  files: File[],
  maxBytes: number,
  allowedTypes: string[] | undefined,
  allowedExtensions: string[] | undefined,
): string | null {
  for (const file of files) {
    if (file.size > maxBytes) {
      return (
        `Datei «${file.name}» ist zu groß ` +
        `(max. ${formatMb(maxBytes)} pro Datei).`
      );
    }
    const ext = file.name.includes('.')
      ? `.${file.name.split('.').pop()!.toLowerCase()}`
      : '';
    const extOk =
      !allowedExtensions ||
      allowedExtensions.some((e) => e.toLowerCase() === ext);
    // Browsers sometimes report an empty `type`; in that case fall back to
    // the extension check rather than rejecting outright.
    const typeOk =
      !allowedTypes ||
      file.type === '' ||
      allowedTypes.includes(file.type);
    if (!extOk || !typeOk) {
      return `Datei «${file.name}» hat ein nicht unterstütztes Format.`;
    }
  }
  return null;
}

export default function FileImportSection({
  icon: Icon,
  title,
  description,
  accept,
  multiple = false,
  helpText,
  buttonIdleLabel,
  buttonBusyLabel,
  onImport,
  busy,
  maxBytes = DEFAULT_CSV_MAX_BYTES,
  allowedTypes,
  allowedExtensions,
  testId,
}: FileImportSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultBanner, setResultBanner] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setResultBanner(null);
    setWarnings([]);
    const files = Array.from(fileList);

    const validationError = validateFiles(
      files,
      maxBytes,
      allowedTypes,
      allowedExtensions,
    );
    if (validationError) {
      setError(validationError);
      // Reset the input so re-selecting the same file fires `onChange`.
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const outcome = await onImport(files);
      setResultBanner(outcome.banner);
      setWarnings(outcome.warnings ?? []);
    } catch (err) {
      setError(extractApiError(err, 'Import fehlgeschlagen'));
    } finally {
      // Reset the input so re-selecting the same file fires `onChange`.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <section
      className="bg-surface-container-low rounded-2xl border border-white/5 p-6"
      data-testid={testId}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-headline font-bold text-on-surface">{title}</h3>
          <p className="text-xs text-on-surface-variant">{description}</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-3 rounded-lg text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50"
      >
        {busy ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Icon className="w-4 h-4" />
        )}
        {busy ? buttonBusyLabel : buttonIdleLabel}
      </button>

      <p className="mt-4 text-[11px] text-on-surface-variant leading-relaxed">
        {helpText}
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
          {warnings.map((warning) => (
            <li
              key={warning}
              className="text-[11px] text-warning leading-relaxed"
            >
              {warning}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
