/**
 * TAN-modal copy, keyed by the provider's `tan_kind` (M16-P2a).
 *
 * The sync TAN modal is provider-neutral: the worker's sync-start
 * response carries a `provider` block, and these helpers turn it into
 * the modal subtitle + instruction paragraph. Comdirect
 * (`decoupled_app_push`) renders the exact pre-P2a copy — no UX regress.
 *
 * P2b/P2c add the `sms` / `email_otp` / `scraping_session` providers;
 * their strings already live here so the modal needs no further change.
 */
import type { SyncProviderInfo } from '../api/sync';

/** Banking-app label, e.g. "Comdirect photoTAN App" or "Comdirect App". */
function appLabel(provider: SyncProviderInfo): string {
  return provider.display_hint
    ? `${provider.display_name} ${provider.display_hint} App`
    : `${provider.display_name} App`;
}

/** Subtitle under the "Push-TAN bestätigen" modal heading. */
export function tanModalSubtitle(provider: SyncProviderInfo): string {
  return provider.display_hint
    ? `${provider.display_name} ${provider.display_hint} App`
    : provider.display_name;
}

/** Instruction paragraph shown in the TAN modal body. */
export function tanModalInstruction(provider: SyncProviderInfo): string {
  const { display_name, tan_kind } = provider;
  switch (tan_kind) {
    case 'decoupled_app_push':
      return (
        `Öffne die ${appLabel(provider)} auf deinem Smartphone und bestätige ` +
        `die Anmeldung. Klicke danach unten auf «Bestätigt» — ` +
        `${display_name}-Daten werden geladen und normalisiert (~10–20 s). ` +
        `KI-Kategorisierung startest du danach separat unter «Agents».`
      );
    case 'sms':
      return (
        `${display_name} hat dir einen TAN-Code per SMS geschickt. Bestätige ` +
        `die Anmeldung und klicke danach unten auf «Bestätigt».`
      );
    case 'email_otp':
      return (
        `${display_name} hat dir einen Bestätigungscode per E-Mail geschickt. ` +
        `Bestätige die Anmeldung und klicke danach unten auf «Bestätigt».`
      );
    case 'scraping_session':
      return (
        `Bestätige die Anmeldung bei ${display_name} und klicke danach unten ` +
        `auf «Bestätigt» — die Daten werden geladen und normalisiert.`
      );
    default:
      return (
        `Bestätige die Anmeldung bei ${display_name} und klicke danach unten ` +
        `auf «Bestätigt».`
      );
  }
}
