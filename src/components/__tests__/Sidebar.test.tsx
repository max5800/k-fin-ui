import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from '../Sidebar';

vi.mock('../../api/categorization', () => ({
  usePendingSuggestions: () => ({ data: { items: [] } }),
}));

vi.mock('../../api/dev', () => ({
  useDevStatus: () => ({ data: { enabled: false } }),
}));

function renderSidebar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Sidebar', () => {
  it('keeps the primary navigation available for mobile layouts', () => {
    renderSidebar();
    const mobileNav = screen.getByRole('navigation', { name: 'Hauptnavigation' });

    expect(within(mobileNav).getByRole('link', { name: /dashboard/i })).toHaveAttribute(
      'href',
      '/',
    );
    expect(within(mobileNav).getByRole('link', { name: /transaktionen/i })).toHaveAttribute(
      'href',
      '/transactions',
    );
    expect(within(mobileNav).getByRole('link', { name: /portfolio/i })).toHaveAttribute(
      'href',
      '/portfolio',
    );
    expect(within(mobileNav).getByRole('button', { name: /abmelden/i })).toBeInTheDocument();
  });
});
