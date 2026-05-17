// Single source of truth for the upstream data-source enum and its labels.
//
// Before this module the same provider knowledge was copy-pasted across
// Transactions (filter chips), TopBar (last-sync indicator) and
// SyncRunsHistory (run table) — and the copies had already diverged:
// `santander_cc` was missing from TopBar and SyncRunsHistory, so a
// Santander row rendered the raw enum string. Every display site now
// derives from `DATA_SOURCES`; adding a source touches only this file.

/** Closed set of upstream providers — matches the backend `DataSource` enum. */
export type DataSource = 'comdirect' | 'paypal' | 'santander_cc';

export interface DataSourceMeta {
  value: DataSource;
  /** Full provider name — TopBar last-sync, sync-run history table. */
  label: string;
  /** Compact label for filter chips where horizontal space is tight. */
  chipLabel: string;
}

export const DATA_SOURCES: Record<DataSource, DataSourceMeta> = {
  comdirect: { value: 'comdirect', label: 'Comdirect', chipLabel: 'Bank' },
  paypal: { value: 'paypal', label: 'PayPal', chipLabel: 'PayPal' },
  santander_cc: {
    value: 'santander_cc',
    label: 'Santander-CC',
    chipLabel: 'Santander-CC',
  },
};

/** All sources in stable display order — for building chip/menu lists. */
export const DATA_SOURCE_LIST: DataSourceMeta[] = Object.values(DATA_SOURCES);

/** True when `source` is a known `DataSource`. */
export function isDataSource(source: string): source is DataSource {
  return source in DATA_SOURCES;
}

/** Full provider label; falls back to the raw string for unknown sources. */
export function dataSourceLabel(source: string): string {
  return isDataSource(source) ? DATA_SOURCES[source].label : source;
}
