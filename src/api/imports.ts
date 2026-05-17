import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

// Result of a PayPal "Kontoauszug" CSV import — mirrors PayPalImportResult
// in the backend's src/api/routers/import_csv.py.
export interface PayPalImportResult {
  parsed: number; // real transactions read (funding/plumbing rows skipped)
  inserted: number; // newly-inserted raw rows
  duplicates: number; // rows already present from an earlier upload
  normalized: number; // rows in the normalized table after the run
}

// Upload a PayPal account-statement CSV. The backend parses, ingests and
// re-normalizes in one call — no worker hop, the file carries no secrets.
export function useImportPaypalCsv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<PayPalImportResult> => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await apiClient.post<PayPalImportResult>(
        '/import/paypal-csv',
        form,
      );
      return data;
    },
    // The import runs a full normalization pass — every server view
    // (transactions, aggregates, sync history …) may have changed.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

// Result of a Santander statement-PDF import — mirrors SantanderImportResult
// in the backend's src/api/routers/import_csv.py.
export interface SantanderImportResult {
  statements: number; // PDF files parsed successfully
  parsed: number; // transactions read across all statements
  inserted: number; // newly-inserted raw rows
  duplicates: number; // rows already present from an earlier upload
  normalized: number; // rows in the normalized table after the run
  errors: string[]; // per-file failures — a bad file is skipped, not fatal
}

// Upload one or more Santander 1plus-Card statement PDFs. The card is not
// reachable via PSD2/XS2A, so it is ingested from the monthly MySantander
// statement PDFs. The backend parses, ingests and re-normalizes in one call.
export function useImportSantanderPdf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]): Promise<SantanderImportResult> => {
      const form = new FormData();
      for (const file of files) form.append('files', file);
      const { data } = await apiClient.post<SantanderImportResult>(
        '/import/santander-pdf',
        form,
      );
      return data;
    },
    // The import runs a full normalization pass — invalidate every view.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
