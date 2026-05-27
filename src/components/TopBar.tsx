import { RefreshCw } from 'lucide-react';
import { FRONTEND_VERSION, useAppVersion } from '../api/meta';
import { useLastSync } from '../api/sync';
import { formatRelativeDate } from '../lib/format';
import { dataSourceLabel } from '../lib/dataSources';

interface TopBarProps {
  title?: string;
  subtitle?: string;
}

function LastSyncIndicator() {
  const { data } = useLastSync();
  if (!data || data.length === 0) return null;

  return (
    <div className="hidden md:flex items-center gap-2 text-xs text-on-surface-variant font-medium">
      <RefreshCw className="w-3.5 h-3.5 opacity-60" />
      <span className="flex items-center gap-2">
        {data.map((entry, i) => (
          <span key={entry.data_source} className="flex items-center gap-2">
            {i > 0 && <span className="opacity-30">•</span>}
            <span>
              {dataSourceLabel(entry.data_source)}{' '}
              <span className="opacity-60">
                {formatRelativeDate(entry.finished_at ?? entry.started_at)}
              </span>
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}

function formatVersion(version: string | undefined | null) {
  if (!version || version === 'unknown') return null;
  return version.startsWith('v') ? version : `v${version}`;
}

function VersionIndicator() {
  const { data } = useAppVersion();
  const frontend = formatVersion(FRONTEND_VERSION);
  const backend = formatVersion(data?.backend_version);
  if (!frontend && !backend) return null;

  return (
    <div className="hidden lg:flex items-center gap-2 text-[11px] text-on-surface-variant font-medium tabular-nums">
      {frontend && <span>FE {frontend}</span>}
      {frontend && backend && <span className="opacity-30">•</span>}
      {backend && <span>BE {backend}</span>}
    </div>
  );
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  const displayName = localStorage.getItem('kfin_display_name');

  return (
    <header className="fixed top-0 right-0 w-[calc(100%-16rem)] z-40 bg-background/70 backdrop-blur-xl flex items-center justify-between px-8 h-20">
      <div className="flex flex-col">
        {title && (
          <h2 className="text-xl font-headline font-extrabold tracking-tight text-on-surface">
            {title}
          </h2>
        )}
        {subtitle && (
          <p className="text-[10px] text-on-surface-variant font-medium tracking-widest uppercase">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-6">
        <LastSyncIndicator />
        <VersionIndicator />
        {displayName && (
          <span className="text-xs text-on-surface-variant font-medium">
            Hi, {displayName}
          </span>
        )}
      </div>
    </header>
  );
}
