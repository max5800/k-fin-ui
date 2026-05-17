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

// Upload one file with a forced byte size — `File.size` is read-only, so
// we patch the descriptor for the oversize-rejection test.
function uploadSized(
  container: HTMLElement,
  opts: { name: string; type: string; size: number },
) {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error('file input not found');
  const file = new File(['%PDF-1.4'], opts.name, { type: opts.type });
  Object.defineProperty(file, 'size', { value: opts.size });
  fireEvent.change(input, { target: { files: [file] } });
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

  it('rejects an oversized PDF client-side without uploading', async () => {
    let posted = false;
    mockPostImpl = async () => {
      posted = true;
      return { data: {} };
    };
    const { container } = renderSection();

    uploadSized(container, {
      name: 'statement.pdf',
      type: 'application/pdf',
      size: 21 * 1024 * 1024, // over the 20 MB PDF cap
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('zu groß');
    expect(posted).toBe(false);
  });

  it('renders each per-file warning as its own list item', async () => {
    mockPostImpl = async () => ({
      data: {
        statements: 0,
        parsed: 0,
        inserted: 0,
        duplicates: 0,
        normalized: 0,
        errors: [
          'statement-0.pdf: not a recognisable 1plus-Card statement',
          'statement-1.pdf: balance mismatch',
        ],
      },
    });
    const { container } = renderSection();

    uploadPdfs(container, 2);

    await screen.findByText(/balance mismatch/i);
    const items = container.querySelectorAll('ul li');
    expect(items).toHaveLength(2);
  });
});
