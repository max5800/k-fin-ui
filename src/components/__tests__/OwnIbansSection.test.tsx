import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OwnIbansSection from '../OwnIbansSection';

// `apiClient.get` / `.put` are replaced per-test with plain async functions —
// not vi.fn() spies, whose result-tracking keeps a handle on a rejected
// promise that Vitest then reports as an unhandled rejection.
let mockGetImpl: () => Promise<{ data: unknown }>;
let mockPutImpl: () => Promise<{ data: unknown }>;
vi.mock('../../api/client', () => ({
  apiClient: {
    get: () => mockGetImpl(),
    put: () => mockPutImpl(),
  },
}));

const SETTINGS = {
  auto_apply_confidence: 0.6,
  page_size: 25,
  webhook_url: null,
  own_ibans: ['DE00000000000000000000', 'DE00000000000000000001'],
};

// The stored IBANs as the textarea renders them — one per line.
const LOADED = 'DE00000000000000000000\nDE00000000000000000001';

function renderSection() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <OwnIbansSection />
    </QueryClientProvider>,
  );
}

// Resolve the textarea once the settings query has populated the draft.
// `findByDisplayValue` normalises whitespace, so it can't match a multi-line
// value — assert the raw `.value` instead.
async function loadedTextarea(): Promise<HTMLTextAreaElement> {
  const textarea = (await screen.findByRole('textbox')) as HTMLTextAreaElement;
  await waitFor(() => expect(textarea.value).toBe(LOADED));
  return textarea;
}

describe('OwnIbansSection', () => {
  beforeEach(() => {
    mockGetImpl = async () => ({ data: SETTINGS });
    mockPutImpl = async () => ({ data: SETTINGS });
  });

  it('loads the stored IBANs into the textarea, one per line', async () => {
    renderSection();
    await loadedTextarea();
  });

  it('saves the edited IBAN list and shows a confirmation', async () => {
    mockPutImpl = async () => ({
      data: { ...SETTINGS, own_ibans: ['DE00000000000000000000'] },
    });
    renderSection();

    const textarea = await loadedTextarea();
    fireEvent.change(textarea, {
      target: { value: 'DE00000000000000000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Speicher/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('Gespeichert');
  });

  it('surfaces the backend error detail when the save fails', async () => {
    mockPutImpl = () =>
      Promise.reject({
        isAxiosError: true,
        response: { data: { detail: "Not a valid IBAN: 'nonsense'" } },
      });
    renderSection();

    const textarea = await loadedTextarea();
    fireEvent.change(textarea, { target: { value: 'nonsense' } });
    fireEvent.click(screen.getByRole('button', { name: /Speicher/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Not a valid IBAN',
    );
  });
});
