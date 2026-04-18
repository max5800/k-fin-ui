import {
  LayoutGrid,
  ReceiptText,
  Wallet,
  FileText,
  HelpCircle,
  Sparkles,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { usePendingSuggestions } from '../api/categorization';

export default function Sidebar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: pending } = usePendingSuggestions();
  const pendingCount = pending?.items.length ?? 0;

  const menuItems = [
    { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
    { to: '/transactions', label: 'Transaktionen', icon: ReceiptText },
    { to: '/budgets', label: 'Budgets', icon: Wallet },
    { to: '/agents', label: 'Agents', icon: Sparkles },
    { to: '/review', label: 'Review', icon: HelpCircle, badge: pendingCount },
    { to: '/reports', label: 'Reports', icon: FileText },
    { to: '/settings', label: 'Einstellungen', icon: SettingsIcon },
  ];

  const handleLogout = () => {
    localStorage.removeItem('kfin_token');
    queryClient.clear();
    navigate('/login');
  };

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 border-r border-white/10 bg-surface-container-low flex flex-col py-8 px-4 font-headline antialiased z-50">
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
  );
}
