import {
  LayoutGrid,
  ReceiptText,
  TrendingUp,
  Tags,
  FileText,
  FlaskConical,
  HelpCircle,
  Sparkles,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { usePendingSuggestions } from '../api/categorization';
import { useDevStatus } from '../api/dev';

export default function Sidebar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: pending } = usePendingSuggestions();
  const { data: devStatus } = useDevStatus();
  // Sidebar surfaces only the *urgent* review stream — agent suggestions
  // waiting on the user. Refund-audit candidates are an opt-in cleanup
  // workflow (count is shown inside the page on its own tab) and would
  // otherwise drown the badge with low-urgency Altlasten.
  const reviewBadge = pending?.items.length ?? 0;

  const menuItems = [
    { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
    { to: '/transactions', label: 'Transaktionen', icon: ReceiptText },
    { to: '/portfolio', label: 'Portfolio', icon: TrendingUp },
    { to: '/categories', label: 'Kategorien', icon: Tags },
    { to: '/agents', label: 'Agents', icon: Sparkles },
    { to: '/review', label: 'Review', icon: HelpCircle, badge: reviewBadge },
    { to: '/reports', label: 'Reports', icon: FileText },
    { to: '/settings', label: 'Einstellungen', icon: SettingsIcon },
    ...(devStatus?.enabled
      ? [{ to: '/dev', label: 'Dev Tools', icon: FlaskConical }]
      : []),
  ];

  const handleLogout = () => {
    localStorage.removeItem('kfin_token');
    queryClient.clear();
    navigate('/login');
  };

  return (
    <>
      <aside className="h-screen w-64 fixed left-0 top-0 border-r border-white/10 bg-surface-container-low hidden md:flex flex-col py-8 px-4 font-headline antialiased z-50">
        <div className="mb-10 px-4">
          <h1 className="text-2xl font-bold tracking-tighter text-primary uppercase">k-fin</h1>
        </div>

        <nav className="flex-1 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 py-3 px-4 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'text-primary font-semibold border-r-2 border-primary bg-primary/5'
                      : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm flex-1">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full tabular-nums">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/5 px-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 py-2 text-on-surface-variant hover:text-primary transition-colors w-full text-left"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm">Abmelden</span>
          </button>
        </div>
      </aside>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex gap-1 overflow-x-auto border-t border-white/10 bg-surface-container-lowest/95 px-2 py-2 shadow-2xl backdrop-blur md:hidden"
        aria-label="Hauptnavigation"
      >
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex min-w-[4.75rem] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="absolute right-2 top-1 rounded-full bg-primary px-1.5 text-[9px] font-bold text-on-primary">
                  {item.badge}
                </span>
              ) : null}
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={handleLogout}
          className="flex min-w-[4.75rem] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold text-on-surface-variant hover:text-on-surface"
        >
          <LogOut className="h-5 w-5" />
          <span>Abmelden</span>
        </button>
      </nav>
    </>
  );
}
