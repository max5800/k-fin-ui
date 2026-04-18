import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Übersicht' },
  '/transactions': { title: 'Transaktionen', subtitle: 'Buchungen & Kategorien' },
  '/budgets': { title: 'Budgets', subtitle: 'Kategorien & Limits' },
  '/agents': { title: 'Agents', subtitle: 'AI-Pipelines & Runs' },
  '/reports': { title: 'Reports', subtitle: 'Analysen & Exports' },
  '/settings': { title: 'Einstellungen', subtitle: 'Konto & Synchronisation' },
};

export default function MainLayout() {
  const location = useLocation();
  const viewData = VIEW_TITLES[location.pathname];

  // NOTE: Route-level AnimatePresence with motion.div keyed on location.pathname
  // was removed because it remounted the active route whenever a descendant
  // component rendered a nested <AnimatePresence> (e.g. the confirm modal in
  // AgentRuns). That unmount propagated through the portal and closed the
  // modal ~200ms after it opened, breaking single-click flows. The route
  // tree is now rendered as a plain <Outlet /> — route changes still re-key
  // via React Router's internal matching, without the fragile fade-through.
  return (
    <div className="min-h-screen bg-background text-on-surface font-sans antialiased overflow-hidden">
      <Sidebar />

      <main className="pl-64 min-h-screen">
        <TopBar title={viewData?.title} subtitle={viewData?.subtitle} />
        <div className="h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
