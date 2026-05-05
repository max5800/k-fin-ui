# CLAUDE.md — k-fin-ui

## Project

k-fin-ui — React 19 frontend for [k-fin](https://github.com/max5800/k-fin). Talks to the Comdirect-backed Finance API: transactions, categorization, portfolio, reports, agent runs, sync controls. Renders highly sensitive personal banking data; never persists or transmits it anywhere except the user's own k-fin backend.

## Identity

`k-fin` resolves internally to "Klaus Fin" (fish-fin). Klaus is the user's OpenClaw AI assistant — a talking goldfish, former GDR figure-skating champion, living on the home network. k-fin is his finance workbench. **Always write the product as `k-fin`** (lowercase, hyphenated) — never spell out "Klaus Finanzen" or "Klaus Finance" in code, UI strings, logs, commits, or docs. Keep banking code serious; identity stays subtle. Full lore: user's Obsidian vault at `Tech/Firefly & Finanz Sync/IDENTITY.md`.

## Commands

- `npm run dev` — Vite dev server on port 3000 (proxies to k-fin backend)
- `npm run build` — Production build
- `npm run lint` — `tsc --noEmit` (strict TypeScript)
- `npm run test` — Vitest one-shot
- `npm run test:watch` — Vitest in watch mode

## Architecture

Single-page app, all server state through TanStack Query.

- `src/api/` — axios client + per-resource modules (`transactions.ts`, `categories.ts`, `portfolio.ts`, `reports.ts`, `runs.ts`, `sync.ts`, `auth.ts`, `categorization.ts`, `aggregates.ts`, `settings.ts`). `client.ts` owns the auth interceptor and decimal parsing.
- `src/components/` — page-level components (`Dashboard`, `Transactions`, `Categories`, `Portfolio`, `Reports`, `AgentRuns`, `Settings`, `Onboarding`, `BackfillSection`, `PendingReview`) plus shell (`MainLayout`, `Sidebar`, `TopBar`, `ProtectedRoute`, `Login`).
- `src/lib/` — `format.ts` (`Intl.NumberFormat('de-DE', EUR)`, date-fns `de` locale), `queryKeys.ts` (TanStack Query key factory).
- `src/test/` — Vitest setup + jsdom env.
- `server.js` — Express prod server with http-proxy-middleware to the k-fin backend.

## Stack

- React 19 + TypeScript (strict)
- Vite + Tailwind v4
- TanStack Query v5 (all server state — no Redux/Zustand for server data)
- react-hook-form + zod
- react-router-dom v7
- date-fns (`de` locale) + `Intl.NumberFormat('de-DE', EUR)`
- axios (auth interceptor + decimal parsing)
- motion, lucide-react, recharts

## Key Rules

- **The repo is public.** Anything that lands on `main` is world-readable on GitHub. Treat every commit, screenshot, fixture, and log line as if a stranger will read it.
- **No real banking data anywhere.** Use obvious dummy values in tests, mocks, and Storybook-style fixtures: `DE00000000000000000000` for IBANs, `John Doe`, round numbers like `100.00 EUR`. Never paste a real Comdirect response into the repo.
- **Never log sensitive data** (IBANs, balances, full account numbers, tokens, PINs) in `console.*`, telemetry, or error reporters. Mask in user-facing error states too.
- **All secrets via env vars.** `.env` is git-ignored; `.env.example` is the public template with placeholders only.
- **Secret scanning is mandatory.** `.husky/pre-commit` runs `gitleaks protect --staged` against [.gitleaks.toml](.gitleaks.toml); CI re-runs it. When introducing a new secret-shaped pattern (credential env var, IBAN-shaped fixture, personal hostname), either fix it or add a narrow allowlist entry in `.gitleaks.toml` with a comment explaining why it's safe. Never use `git commit --no-verify`. Required tool: `brew install gitleaks`.
- **Read-only against the bank.** The backend enforces this, but UI-side: never build a form that POSTs an order, transfer, or other write to Comdirect — those endpoints don't exist and shouldn't appear to.
- **TanStack Query for server state.** Don't reinvent caching with `useState` + `useEffect`; use the keys from `src/lib/queryKeys.ts`.
- **Money is decimal.** Parse via the axios decimal helper, format via `src/lib/format.ts`. No `parseFloat` on currency values.
- **Conventional commits required** (`commitlint` enforces).
- **Companion repo:** [k-fin](https://github.com/max5800/k-fin) is the backend. API contracts live there — when an endpoint shape changes, both repos move together.
