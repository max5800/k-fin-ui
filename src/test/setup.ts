import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Node 25 ships an experimental built-in `localStorage` global that masks
// jsdom's Storage implementation and is not API-complete (no .clear/.getItem
// when --localstorage-file is unset). Install a minimal in-memory shim so
// tests get a predictable Web Storage API on both window and globalThis.
function installStorageShim(): Storage {
  const store = new Map<string, string>();
  const api: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => {
      store.delete(k);
    },
    setItem: (k, v) => {
      store.set(k, String(v));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: api, configurable: true });
  Object.defineProperty(window, 'localStorage', { value: api, configurable: true });
  return api;
}

installStorageShim();

beforeEach(() => {
  installStorageShim();
});

afterEach(() => {
  cleanup();
});
