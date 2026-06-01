# Codex Agent Registry - k-fin-ui

This file bridges the existing Claude instructions into Codex. Keep the source
definition in its native location and treat this file as the Codex-facing index.

## Source Definitions

- Project rules: `CLAUDE.md`
- GitHub workflows: `.github/workflows/*.yml`

When rules conflict, follow the stricter security or privacy rule. If docs
conflict with code, inspect the current code and preserve the banking-data
invariants from `CLAUDE.md`.

## Project Invariants

- This is a public OSS frontend for sensitive banking data. Never introduce
  real IBANs, balances, credentials, hostnames, tokens, PINs, screenshots, or
  personal infrastructure paths.
- Keep `k-fin` lowercase and hyphenated in code, UI strings, commits, logs, and
  docs.
- The real app talks only to the user's own k-fin backend. Do not add telemetry,
  third-party reporting, or data exfiltration paths.
- The public demo is intentionally backend-less. `VITE_DEMO_MODE=true` must run
  entirely in the browser using `src/demo/*` and `localStorage`; do not add a
  hosted API, database, worker, Comdirect flow, or secrets for the demo.
- Demo fixtures must remain obvious dummy data such as
  `DE00000000000000000000` and `John Doe`. A demo token like `demo-token` is a
  UI sentinel, not authentication material.
- GitHub Pages deploys only the static demo artifact through
  `.github/workflows/demo-pages.yml`. The normal release workflow and container
  image remain for self-hosted real deployments.
- Use `npm run lint` and `npm run test` before declaring implementation work
  done when scope and time allow. For demo-specific changes, also run a demo
  build such as `VITE_DEMO_MODE=true npm run build`.

## Stop Hook Parity

Before finishing implementation, commit, or review work that touched files,
run a quick security-reviewer perspective scan over the modified files for:

- hardcoded secrets or real credentials
- real banking data or personal identifiers
- sensitive data in logs or errors
- unexpected network calls from the browser demo

Report actual issues only. If clean, state that the modified files passed the
security hook check.
