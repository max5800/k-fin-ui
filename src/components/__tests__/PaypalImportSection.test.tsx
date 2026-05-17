import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PaypalImportSection from '../PaypalImportSection';

// `apiClient.post` is replaced per-test with a *plain* async function — not
// a vi.fn() spy. A spy's result-tracking keeps a handle on the returned
// rejected promise, which Vitest then reports as an unhandled rejection.
// The post arguments (endpoint, FormData) are covered by api/__tests__/imports.test.tsx.
let mockPostImpl: () => Promise<{ data: unknown }>;
vi.mock('../../api/client', () => ({
  apiClient: { post: () => mockPostImpl() },
}));

function renderSection() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <PaypalImportSection />
    </QueryClientProvider>,
  );
}

function uploadCsv(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error('file input not found');
  const file = new File(['Datum\n08.05.2026'], 'kontoauszug.csv', {
    type: 'text/csv',
  });
  fireEvent.change(input, { target: { files: [file] } });
}

describe('PaypalImportSection', () => {
  beforeEach(() => {
    mockPostImpl = async () => ({ data: {} });
  });

  it('renders the CSV upload button', () => {
    renderSection();
    expect(
      screen.getByRole('button', { name: /CSV-Datei auswählen/i }),
    ).toBeInTheDocument();
  });

  it('uploads the selected file and shows the import summary', async () => {
    mockPostImpl = async () => ({
      data: { parsed: 12, inserted: 10, duplicates: 2, normalized: 12 },
    });
    const { container } = renderSection();

    uploadCsv(container);

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent('12 Transaktion(en) gelesen');
    expect(banner).toHaveTextContent('10 neu, 2 Duplikat(e)');
  });

  it('surfaces the backend error detail when the import fails', async () => {
    mockPostImpl = () =>
      Promise.reject({
        isAxiosError: true,
        response: {
          data: {
            detail: 'PayPal CSV is missing required column(s): Transaktionscode',
          },
        },
      });
    const { container } = renderSection();

    uploadCsv(container);

    expect(await screen.findByRole('alert')).toHaveTextContent('Transaktionscode');
  });
});
