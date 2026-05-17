import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SantanderImportSection from '../SantanderImportSection';

// `apiClient.post` is replaced per-test with a *plain* async function — not
// a vi.fn() spy, whose result-tracking keeps a handle on the rejected
// promise that Vitest then reports as an unhandled rejection.
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
      <SantanderImportSection />
    </QueryClientProvider>,
  );
}

function uploadPdfs(container: HTMLElement, count = 1) {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error('file input not found');
  const files = Array.from(
    { length: count },
    (_, i) =>
      new File(['%PDF-1.4'], `statement-${i}.pdf`, {
        type: 'application/pdf',
      }),
  );
  fireEvent.change(input, { target: { files } });
}

describe('SantanderImportSection', () => {
  beforeEach(() => {
    mockPostImpl = async () => ({ data: {} });
  });

  it('renders the PDF upload button', () => {
    renderSection();
    expect(
      screen.getByRole('button', { name: /PDF-Abrechnungen auswählen/i }),
    ).toBeInTheDocument();
  });

  it('uploads the selected statements and shows the import summary', async () => {
    mockPostImpl = async () => ({
      data: {
        statements: 2,
        parsed: 25,
        inserted: 20,
        duplicates: 5,
        normalized: 25,
        errors: [],
      },
    });
    const { container } = renderSection();

    uploadPdfs(container, 2);

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent('2 Abrechnung(en)');
    expect(banner).toHaveTextContent('25 Transaktion(en) gelesen');
    expect(banner).toHaveTextContent('20 neu, 5 Duplikat(e)');
  });

  it('lists per-file errors from a partial import', async () => {
    mockPostImpl = async () => ({
      data: {
        statements: 1,
        parsed: 10,
        inserted: 10,
        duplicates: 0,
        normalized: 10,
        errors: ['statement-1.pdf: not a recognisable 1plus-Card statement'],
      },
    });
    const { container } = renderSection();

    uploadPdfs(container, 2);

    expect(
      await screen.findByText(/not a recognisable 1plus-Card statement/i),
    ).toBeInTheDocument();
  });

  it('surfaces the backend error detail when the import fails', async () => {
    mockPostImpl = () =>
      Promise.reject({
        isAxiosError: true,
        response: {
          data: { detail: 'no statement PDF was uploaded' },
        },
      });
    const { container } = renderSection();

    uploadPdfs(container, 1);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'no statement PDF',
    );
  });
});
