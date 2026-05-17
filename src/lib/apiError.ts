import { isAxiosError } from 'axios';

/**
 * Extract a human-readable message from an API error.
 *
 * The backend returns FastAPI's standard error shapes: `{ detail: string }`
 * for explicit `HTTPException`s, and `{ detail: [{ msg, ... }] }` for
 * pydantic-422 validation errors. Anything else falls back to `fallback`.
 *
 * Single source of truth — replaces the per-component `extractError`
 * copies that had drifted (some handled the 422 array form, some did not).
 */
export function extractApiError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) {
      return String(detail[0].msg);
    }
  }
  return fallback;
}
