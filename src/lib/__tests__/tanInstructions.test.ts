import { describe, expect, it } from 'vitest';
import type { SyncProviderInfo } from '../../api/sync';
import { tanModalInstruction, tanModalSubtitle } from '../tanInstructions';

const comdirect: SyncProviderInfo = {
  source: 'comdirect',
  display_name: 'Comdirect',
  tan_kind: 'decoupled_app_push',
  display_hint: 'photoTAN',
};

describe('tanModalSubtitle', () => {
  it('renders "<name> <hint> App" when a hint is present', () => {
    expect(tanModalSubtitle(comdirect)).toBe('Comdirect photoTAN App');
  });

  it('falls back to the display name alone when there is no hint', () => {
    expect(
      tanModalSubtitle({ ...comdirect, display_hint: null }),
    ).toBe('Comdirect');
  });
});

describe('tanModalInstruction', () => {
  it('renders the exact pre-P2a Comdirect copy (no UX regression)', () => {
    // Byte-identical to the string the hardcoded modal showed before P2a.
    expect(tanModalInstruction(comdirect)).toBe(
      'Öffne die Comdirect photoTAN App auf deinem Smartphone und bestätige ' +
        'die Anmeldung. Klicke danach unten auf «Bestätigt» — Comdirect-Daten ' +
        'werden geladen und normalisiert (~10–20 s). KI-Kategorisierung ' +
        'startest du danach separat unter «Agents».',
    );
  });

  it('names the provider for the other tan kinds', () => {
    for (const tan_kind of ['sms', 'email_otp', 'scraping_session']) {
      const text = tanModalInstruction({
        source: 'demo',
        display_name: 'DemoBank',
        tan_kind,
        display_hint: null,
      });
      expect(text).toContain('DemoBank');
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it('has a safe fallback for an unknown tan kind', () => {
    const text = tanModalInstruction({
      source: 'demo',
      display_name: 'DemoBank',
      tan_kind: 'something_new',
      display_hint: null,
    });
    expect(text).toContain('DemoBank');
  });
});
