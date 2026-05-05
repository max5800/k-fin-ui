import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from '../Login';

vi.mock('../../api/auth', () => ({
  useLogin: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

function renderLogin(initialEntry = '/login') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Login />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Login', () => {
  it('does not show the dead "Passwort vergessen?" button', () => {
    renderLogin();
    expect(screen.queryByText(/passwort vergessen/i)).not.toBeInTheDocument();
  });

  it('shows session-expired notice when ?expired=1', () => {
    renderLogin('/login?expired=1');
    expect(screen.getByRole('alert')).toHaveTextContent(/sitzung abgelaufen/i);
  });

  it('does not show the expired notice without the query param', () => {
    renderLogin('/login');
    expect(screen.queryByText(/sitzung abgelaufen/i)).not.toBeInTheDocument();
  });

  it('rejects passwords shorter than 12 characters', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByPlaceholderText('you@example.com'), 'max@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'short');
    await user.click(screen.getByRole('button', { name: /anmelden/i }));

    expect(await screen.findByText(/mindestens 12 zeichen/i)).toBeInTheDocument();
  });
});
