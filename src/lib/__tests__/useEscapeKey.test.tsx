import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { useEscapeKey } from '../useEscapeKey';

function pressKey(key: string) {
  fireEvent.keyDown(document, { key });
}

describe('useEscapeKey', () => {
  it('ruft onEscape auf, wenn Escape gedrückt wird und active true ist', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(true, onEscape));

    pressKey('Escape');

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('ruft onEscape NICHT auf, wenn active false ist', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(false, onEscape));

    pressKey('Escape');

    expect(onEscape).not.toHaveBeenCalled();
  });

  it('ignoriert andere Tasten', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(true, onEscape));

    pressKey('Enter');
    pressKey('a');
    pressKey(' ');

    expect(onEscape).not.toHaveBeenCalled();
  });

  it('verwendet den aktuellen onEscape nach einem Re-Render ohne Listener-Rebind', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => useEscapeKey(true, cb), {
      initialProps: { cb: first },
    });

    rerender({ cb: second });
    pressKey('Escape');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
