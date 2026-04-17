import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
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

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans antialiased overflow-hidden">
      <Sidebar />

      <main className="pl-64 min-h-screen">
        <TopBar title={viewData?.title} subtitle={viewData?.subtitle} />

        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
