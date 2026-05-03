# Security Policy

k-fin-ui is the frontend for [k-fin](https://github.com/max5800/k-fin), a personal-finance app that handles banking data via the Comdirect REST API. Security reports are taken seriously.

## Reporting a Vulnerability

**Please do not open public GitHub issues for security findings.**

Send a private report by email to:

> **[rehms.maximilian@gmail.com](mailto:rehms.maximilian@gmail.com)** — subject prefix `[k-fin security]`

For details on what to include, scope, and disclosure process, see the main project's [SECURITY.md](https://github.com/max5800/k-fin/blob/main/SECURITY.md). The same policy applies here.

## Pre-commit Secret Scanning

This repo enforces a two-layer secret-scanning gate matching the backend repo:

1. **Local pre-commit hook** ([.husky/pre-commit](.husky/pre-commit)) runs [gitleaks](https://github.com/gitleaks/gitleaks) against staged content using the rules in [.gitleaks.toml](.gitleaks.toml). Required tool:

   ```bash
   brew install gitleaks
   ```

   The hook fails closed if `gitleaks` is missing.

2. **CI enforcement** ([.github/workflows/security.yml](.github/workflows/security.yml)) re-runs the same scan on every PR. A failing CI scan blocks the PR.

### Handling a finding

- **Real secret** — remove it, rotate the credential.
- **False positive** — add a narrow allowlist regex to `.gitleaks.toml` with a comment explaining why the value is safe.

### Scope of custom rules

The UI-specific custom rules cover:

- Hardcoded production `VITE_API_BASE_URL` values (allowlists `localhost`, `*.example.*`, `*.local`)
- Embedded `Bearer` tokens in source (allows runtime template strings like `` `Bearer ${token}` ``)
- The maintainer's personal infrastructure domain (`max5800.com`)

Plus all gitleaks default rules — AWS, GCP, Anthropic, OpenAI, GitHub tokens, JWTs, private keys, generic high-entropy strings.

## Frontend-specific Security Notes

A few invariants worth knowing before reporting:

- **Token storage in `localStorage`.** The current login flow stores the JWT in `localStorage.kfin_token`. This is a known XSS risk (any DOM XSS can read it). Reports of XSS or token-exfiltration paths are highly relevant. The migration to `HttpOnly` cookies is tracked in the backend roadmap.
- **No third-party telemetry.** k-fin-ui ships no analytics, tracking, or external scripts. Bundle additions that introduce them should be flagged.
- **Decimal handling.** Financial values are parsed via `axios` interceptor (see `src/api/client.ts`); reports of precision loss leading to balance display errors are in scope.
