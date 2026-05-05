import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../ProtectedRoute';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/secret" element={<div>secret content</div>} />
        </Route>
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects to /login when no token in localStorage', () => {
    renderAt('/secret');
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('renders the protected outlet when token exists', () => {
    localStorage.setItem('kfin_token', 'fake-jwt');
    renderAt('/secret');
    expect(screen.getByText('secret content')).toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
  });
});
