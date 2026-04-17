import { Cloud, Layers, LogOut, RefreshCw, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useStartSync, useNormalizeSync } from '../api/sync';

export default function Settings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { mutate: startSync, isPending: isSyncing } = useStartSync();
  const { mutate: normalize, isPending: isNormalizing } = useNormalizeSync();

  const handleLogout = () => {
    localStorage.removeItem('kfin_token');
    queryClient.clear();
    navigate('/login');
  };

  return (
    <div className="pt-24 px-8 pb-12 h-screen overflow-y-auto">
      <div className="max-w-3xl space-y-8">
        <header className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-headline font-extrabold text-on-surface tracking-tight">
              Einstellungen
            </h2>
            <p className="text-on-surface-variant text-sm mt-1">
              Konto, Synchronisation und System
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-error/10 text-error rounded-lg text-sm font-bold border border-error/20 hover:bg-error/20 transition-all"
          >
            <LogOut className="w-4 h-4" /> Abmelden
          </button>
        </header>

        <section className="bg-surface-container-low rounded-2xl border border-white/5 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-on-surface">Synchronisation</h3>
              <p className="text-xs text-on-surface-variant">
                Comdirect-Daten abrufen und normalisieren
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => startSync()}
              disabled={isSyncing}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-on-primary py-3 rounded-lg text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sync läuft...' : 'Sync starten'}
            </button>
            <button
              onClick={() => normalize()}
              disabled={isNormalizing}
              className="flex-1 flex items-center justify-center gap-2 bg-surface-container-high hover:bg-surface-container-highest py-3 rounded-lg text-sm font-bold text-on-surface transition-all disabled:opacity-50"
            >
              <Layers className={`w-4 h-4 ${isNormalizing ? 'animate-pulse' : ''}`} />
              {isNormalizing ? 'Normalisiere...' : 'Normalisieren'}
            </button>
          </div>
        </section>

        <section className="bg-surface-container-low rounded-2xl border border-white/5 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-on-surface">Profil</h3>
              <p className="text-xs text-on-surface-variant">
                Persönliche Einstellungen
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-on-surface-variant">Sprache</span>
              <span className="text-on-surface font-bold">Deutsch</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-on-surface-variant">Währung</span>
              <span className="text-on-surface font-bold">EUR</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-on-surface-variant">Zeitzone</span>
              <span className="text-on-surface font-bold">Europe/Berlin</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
