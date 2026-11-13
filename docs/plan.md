# Quotewright plan

The full plan artifact at https://claude.ai/artifact/1w3b79S8cRwbey5sEAC4v8 returned no readable body on 2026-11-12. This file is the execution plan from `AGENT_HANDOFF.md`.

## Mission

Replace the Salesbuildr quote-to-order path for Integrid. HaloPSA remains the system of record for clients, sites, contacts, items, opportunities, quotations, sales orders, and purchase orders. Quotewright owns catalog search, quote building, the client quote page, acceptance, and Benji Pays deposits.

## Stack

Next.js (App Router), TypeScript, Tailwind, Drizzle, Postgres, Auth.js with Microsoft Entra ID, Vitest, pnpm. Hosting target is Vercel. PDF via Playwright and email via Microsoft Graph are later packages.

## Work packages

| ID | Package | State |
| --- | --- | --- |
| WP0 | API discovery | Blocked. No credentials. See `docs/api/README.md`. |
| WP1 | Foundation | Started. App, schema, Entra wiring, CI. A Railway preview is up. Real Entra sign-in still needs the app registration. |
| WP2 | Core contracts | Started. Types, money, outbox worker. |
| WP3 | Halo read sync | Waiting on WP0 fixtures. |
| WP4 | D&H adapter | Waiting on WP0 fixtures. |
| WP5 | Ingram adapter | Waiting on WP0 fixtures. |
| WP6 | Manual and CSV adapter | Started. |
| WP7 | Catalog search | Started against the manual adapter, with failure isolation tested. |
| WP8 | Quote builder | Started against the manual adapter. |
| WP9 | Public page, PDF, acceptance | Not started. |
| WP10 | Benji Pays | Not started. No payment link is minted or stored. |
| WP11 | Halo write-back | Not started. Outbox is the only write path, and it has no Halo handler yet. |
| WP12 | Hardening and cutover | Not started. |
| WP13 | NTS Direct | Blocked until docs arrive. |

## Rules that stay in force

- Halo is the master for clients and items.
- Outbound Halo and Benji writes go through `outbox` with an idempotency key.
- Money is integer cents. A quote line keeps the unit cost it was quoted at.
- Benji payment links are minted at click time and are never stored or emailed.
- Tests use fixtures, never live APIs.
- Secrets stay in environment variables.

## Still needed from Ryan

Entra app registration, Halo API application, Benji Pays API key, D&H and Ingram credentials, NTS docs, sample Salesbuildr PDFs, and the business decisions listed in `docs/decisions.md`. The Railway preview is already up.
