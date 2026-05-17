import { useEffect, useRef } from 'react';

/**
 * Ruft `onEscape` auf, wenn die Escape-Taste gedrückt wird, solange
 * `active` true ist.
 *
 * Zentraler Helfer für Modal-/Drawer-Dismiss: das Escape-Handling war
 * vorher nur in PositionDetailPanel implementiert und in allen anderen
 * Modals gar nicht. `active` sollte false sein, während eine Aktion
 * läuft (z.B. ein Sync bestätigt wird), damit der Dialog nicht
 * mitten in einer Mutation wegklappt.
 */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  // `onEscape` in einem Ref halten, damit der keydown-Listener nicht bei
  // jedem Render (neue Callback-Identität) ab- und wieder angemeldet wird.
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscapeRef.current();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active]);
}
