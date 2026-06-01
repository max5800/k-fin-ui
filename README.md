# k-fin UI

Frontend for [k-fin](https://github.com/max5800/k-fin) — React 19 + TypeScript + Vite.

<p align="center">
  <a href="https://max5800.github.io/k-fin-ui/"><strong>Try the live mock demo</strong></a>
  <br/>
  <sub>Runs fully in your browser with fake finance data. No backend or credentials required.</sub>
</p>

> A personal project, not a finished product. I run it daily against my own k-fin backend and iterate from real usage — features land when I miss them, not on a public roadmap. It works well enough that I trust it with my own finances; whether that bar is high enough for you is your call. No guarantees, no support.

**Companion repo:** [k-fin](https://github.com/max5800/k-fin) — the backend this UI talks to (Comdirect connector, Finance API, normalization pipeline).

## Stack

- React 19 + TypeScript (strict)
- Vite + Tailwind v4
- TanStack Query v5 (all server state)
- react-hook-form + zod (forms)
- react-router-dom v7
- date-fns (`de` locale) + `Intl.NumberFormat('de-DE', EUR)`
- axios (auth interceptor + decimal parsing)
- motion, lucide-react

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment:

   ```bash
   cp .env.example .env.local
   # optional: adjust VITE_API_BASE_URL
   ```

3. Start the backend (in the [k-fin](https://github.com/max5800/k-fin) repo):

   ```bash
   uv run uvicorn main:app --reload
   ```

4. Dev server:

   ```bash
   npm run dev
   ```

   Runs on [http://localhost:3000](http://localhost:3000).

## Static demo

Live demo: [https://max5800.github.io/k-fin-ui/](https://max5800.github.io/k-fin-ui/)

The UI can run as a backend-less public demo. Set `VITE_DEMO_MODE=true` during
the Vite build and every API call is answered from browser-local mock data.
No FastAPI service, Postgres, Comdirect credentials, or worker is involved.

```bash
VITE_DEMO_MODE=true npm run build
npm run preview
```

The GitHub Pages workflow in `.github/workflows/demo-pages.yml` builds that
mode from `main` and publishes the static `dist/` artifact. Demo changes live
only in `localStorage`; the Dev Tools page can reset and reseed the fake data.

## Scripts

- `npm run dev` — Vite dev server (port 3000)
- `npm run build` — Production build
- `npm run lint` — `tsc --noEmit` (strict TS check)
- `npm run preview` — Preview the build

## Structure

```text
src/
  api/            # TanStack Query hooks per resource (+ types, client)
  components/     # Page components + layout
  lib/            # format (Intl/date-fns), queryKeys
  App.tsx         # Router + QueryClient + ErrorBoundary
  main.tsx        # Entry
```

## API integration

All HTTP calls go through [`src/api/client.ts`](src/api/client.ts):

- Base URL from `VITE_API_BASE_URL` (default: `http://localhost:8000/api/v1`)
- Bearer token from `localStorage.kfin_token` (login currently sets a mock token — a real auth endpoint will follow)
- Decimal fields are parsed to `number` in the response interceptor (see `DECIMAL_FIELDS` in `client.ts`)
- 401 → logout + redirect to `/login`

## Built with AI

I do not write the code in this project. Claude (via OpenClaw) writes it; I direct the architecture, product decisions, and review every change before it ships. Treat this as a human-curated AI-built codebase rather than a hand-written one — the design choices are mine, the implementation is the model's.

## Security

See [SECURITY.md](SECURITY.md) for the security policy and how to report a vulnerability. The same disclosure process as the backend [k-fin](https://github.com/max5800/k-fin/blob/main/SECURITY.md) applies here.

## License

Apache License 2.0 — same as the backend [k-fin](https://github.com/max5800/k-fin) repo. See the backend [LICENSE](https://github.com/max5800/k-fin/blob/main/LICENSE) file for the full text.
