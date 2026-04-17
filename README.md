# k-fin UI

Frontend für k-fin — React 19 + TypeScript + Vite.

## Stack

- React 19 + TypeScript (strict)
- Vite + Tailwind v4
- TanStack Query v5 (alle Server-States)
- react-hook-form + zod (Forms)
- react-router-dom v7
- date-fns (`de` Locale) + `Intl.NumberFormat('de-DE', EUR)`
- axios (mit Auth-Interceptor + Decimal-Parsing)
- motion, lucide-react

## Setup

1. Dependencies installieren:

   ```bash
   npm install
   ```

2. Environment konfigurieren:

   ```bash
   cp .env.example .env.local
   # optional: VITE_API_BASE_URL anpassen
   ```

3. Backend starten (im `comdirect-firefly-sync` Repo):

   ```bash
   uv run uvicorn main:app --reload
   ```

4. Dev-Server:

   ```bash
   npm run dev
   ```

   Läuft auf [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — Vite-Dev-Server (Port 3000)
- `npm run build` — Production-Build
- `npm run lint` — `tsc --noEmit` (strict TS-Check)
- `npm run preview` — Preview des Builds

## Struktur

```text
src/
  api/            # TanStack-Query-Hooks pro Ressource (+ types, client)
  components/     # Seitenkomponenten + Layout
  lib/            # format (Intl/date-fns), queryKeys
  App.tsx         # Router + QueryClient + ErrorBoundary
  main.tsx        # Entry
```

## API-Anbindung

Alle HTTP-Calls laufen über [`src/api/client.ts`](src/api/client.ts):

- Base-URL aus `VITE_API_BASE_URL` (Default: `http://localhost:8000/api/v1`)
- Bearer-Token aus `localStorage.kfin_token` (Login setzt aktuell einen Mock-Token — echter Auth-Endpoint folgt)
- Decimal-Felder werden im Response-Interceptor zu `number` geparst (siehe `DECIMAL_FIELDS` in `client.ts`)
- 401 → Logout + Redirect `/login`
