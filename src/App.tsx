import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';

import AgentRuns from './components/AgentRuns';
import Categories from './components/Categories';
import Dashboard from './components/Dashboard';
import DevTools from './components/DevTools';
import Login from './components/Login';
import Onboarding from './components/Onboarding';
import PendingReview from './components/PendingReview';
import Portfolio from './components/Portfolio';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Transactions from './components/Transactions';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function GlobalErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-2xl font-headline font-extrabold text-error mb-4">
        Etwas ist schiefgelaufen
      </h1>
      <pre className="bg-surface-container-lowest p-4 rounded-xl text-xs text-on-surface-variant max-w-lg overflow-auto mb-6">
        {message}
      </pre>
      <button
        onClick={resetErrorBoundary}
        className="bg-primary text-on-primary px-8 py-3 rounded-xl font-bold"
      >
        Erneut versuchen
      </button>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary FallbackComponent={GlobalErrorFallback}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<Onboarding />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="portfolio" element={<Portfolio />} />
                <Route path="categories" element={<Categories />} />
                <Route path="budgets" element={<Navigate to="/categories" replace />} />
                <Route path="agents" element={<AgentRuns />} />
                <Route path="review" element={<PendingReview />} />
                {/* Old standalone refund-audit page → merged into Review tabs.
                    Bookmarks land on the right tab via ?tab=refunds. */}
                <Route
                  path="refund-audit"
                  element={<Navigate to="/review?tab=refunds" replace />}
                />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
                <Route path="dev" element={<DevTools />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
