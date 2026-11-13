# Quotewright

Internal quote builder for Integrid. HaloPSA stays the system of record. This app searches the catalog, builds the quote, and (in later work) publishes it to the client.

The GitHub repository is `integrid-int/salesblaster4000`. Quotewright is the working name.

## Run locally

```bash
pnpm install
cp .env.example .env.local
```

Set `AUTH_DEV_BYPASS=1` in `.env.local` to sign in with an `@integrid.net` address and load sample clients. That switch does nothing when `NODE_ENV` is `production`.

```bash
pnpm dev
```

With no `DATABASE_URL`, the app uses a PGlite database in `.data/pglite`. Set `DATABASE_URL` to use Postgres. Migrations run on startup.

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test
```

## Status

The live preview is https://quotewright-production.up.railway.app. Microsoft sign-in appears after the Entra app registration is set on that Railway service.

Halo, Benji Pays, D&H, and Ingram credentials are not in this environment, so those adapters are not implemented and no live API calls are made. What works now:

- Microsoft Entra sign-in for the Integrid tenant, once the app registration is configured
- Fourteen-table Postgres schema
- Outbox worker for later Halo and Benji writes
- Manual and CSV catalog
- Draft quote builder with snapshotted cost, markup, and margin

See `AGENT_HANDOFF.md`, `docs/plan.md`, and `docs/decisions.md`.
