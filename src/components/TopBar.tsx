interface TopBarProps {
  title?: string;
  subtitle?: string;
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
      {displayName && (
        <span className="text-xs text-on-surface-variant font-medium">
          Hi, {displayName}
        </span>
      )}
    </header>
  );
}
