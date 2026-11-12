# Quotewright: Agent Handoff

Date: 2026-11-12
Owner: Ryan Schneck, Integrid LLC
Full plan: https://claude.ai/artifact/1w3b79S8cRwbey5sEAC4v8 (copy into the repo as `docs/plan.md` during WP1)

You are the lead agent. This file is everything you need to start. Read it fully before spawning any subagent.

## 1. Mission

Build Quotewright, an internal quoting web app for Integrid (an MSP) that replaces Salesbuildr for the quote-to-order path.

HaloPSA stays the system of record for clients, sites, contacts, items, opportunities, quotations, sales orders and purchase orders. Quotewright owns multi-source catalog search, quote building, the client-facing quote page, acceptance, and Benji Pays deposit collection.

"Quotewright" is a working name. Do not spend time on branding.

## 2. Status at handoff

Done:
- Market research and build-versus-buy decision (build).
- Integration feasibility for each source.
- Architecture, data model, work packages and wave order.

Not done:
- No repo, no code, no credentials. Nothing has been verified against a live API.

Every API detail in this file comes from public documentation or third-party references. Treat it as a lead to confirm in WP0, not as fact.

## 3. Hard rules

1. Halo is the system of record. Never make Quotewright the master for clients or items. A distributor product quoted for the first time is created as a Halo item before the quote is pushed.
2. Every outbound write (Halo, Benji Pays) goes through the `outbox` table with an idempotency key. No direct writes from request handlers.
3. Money is integer cents. Every quote line stores the unit cost it was quoted at; later feed changes never alter an existing quote.
4. Benji Pays payment links are minted server-side at click time. Never store one, never put one in an email or PDF. They expire in about an hour.
5. Tests never call live APIs. Use recorded fixtures from WP0. Live sandboxes are hit only by a hand-run smoke script.
6. Secrets live in the host's environment variables. Never in the repo, logs, fixtures or subagent prompts. Scrub tokens and account numbers from fixtures.
7. Stop and ask Ryan before: the first write to production Halo, the first real payment link, any schema change after WP8, sending any email to a real client, and adding a paid service.
8. Do not invent API fields. If a payload shape is not in a WP0 fixture or official docs, mark it as an open question and stop that thread.

## 4. Stack

| Layer | Choice |
| --- | --- |
| App | Next.js (App Router), TypeScript, Tailwind, shadcn/ui |
| Hosting | Vercel (default) or Railway. Pick one in WP1 and log it. |
| Database | Postgres with Drizzle ORM. Neon on Vercel, Railway Postgres on Railway. |
| Auth | Auth.js with the Microsoft Entra ID provider, Integrid tenant only. Roles: `seller`, `admin`. |
| Jobs | Vercel: cron hitting job routes. Railway: one long-running worker. Both drain the `outbox` table. |
| PDF | Playwright rendering the public quote page |
| Email | Microsoft Graph `sendMail` from a shared mailbox |
| Tests | Vitest (unit), Playwright (e2e), recorded fixtures for every external API |
| Package manager | pnpm |

Gate for every branch: `pnpm lint && pnpm typecheck && pnpm test`.

## 5. Core contracts

The lead agent owns `src/core`. After WP2 merges, only the lead agent changes these, and open branches are rebased afterward.

```ts
interface CatalogAdapter {
  id: string; // 'halo' | 'dandh' | 'ingram' | 'nts' | 'manual' | ...
  search(q: string, opts?: SearchOpts): Promise<CatalogItem[]>;
  priceAndAvailability(skus: string[]): Promise<PriceStock[]>;
  healthCheck(): Promise<AdapterHealth>;
}

interface CatalogItem {
  source: string;
  sourceSku: string;
  mfrPartNumber: string | null;
  manufacturer: string | null;
  description: string;
  costCents: number | null;
  msrpCents: number | null;
  stock: number | null;
  fetchedAt: string; // ISO
  haloItemId?: number;
}

interface PaymentProvider {
  createQuotePaymentLink(input: {
    quoteId: string;
    amountCents: number;
    customerName: string;
    reference: string; // quote number
  }): Promise<{ url: string; expiresAt: string }>;
  findPayments(reference: string): Promise<Payment[]>;
}
```

Items from different sources are merged on normalized manufacturer part number so one product shows each source's cost and stock.

## 6. Data model

Fourteen tables. Halo-owned records are cached copies keyed by Halo ID.

| Table | Key fields |
| --- | --- |
| `users` | `entraOid`, `email`, `role`, `haloAgentId` |
| `clients` | `haloClientId`, `name`, `taxCode`, `syncedAt` |
| `sites` | `haloSiteId`, `clientId`, address |
| `contacts` | `haloUserId`, `clientId`, `name`, `email` |
| `opportunities` | `haloTicketId`, `clientId`, `title`, `status` |
| `catalog_items` | `source`, `sourceSku`, `mfrPartNumber`, `costCents`, `stock`, `fetchedAt`, `haloItemId` |
| `quotes` | `number`, `clientId`, `contactId`, `opportunityId`, `status`, `version`, `validUntil`, `depositPercent`, `publicToken`, `haloQuotationId` |
| `quote_sections` | `quoteId`, `title`, `position` |
| `quote_lines` | `sectionId`, `catalogItemId`, `description`, `qty`, `unitCostCents`, `unitPriceCents`, `billing` (once, monthly, annual), `optional`, `selected`, `taxable` |
| `templates` | `kind`, `name`, `body` |
| `pricing_rules` | `scope`, `markupPercent`, `minMarginPercent` |
| `acceptances` | `quoteId`, `version`, `signerName`, `signerEmail`, `ip`, `userAgent`, `pdfSha256`, `acceptedAt` |
| `payments` | `quoteId`, `benjiTransactionId`, `amountCents`, `status`, `applied` |
| `outbox` | `target`, `operation`, `payload`, `idempotencyKey`, `attempts`, `lastError`, `status` |

Quote status: `draft` -> `sent` -> `viewed` -> `accepted` | `declined` | `expired` -> `ordered`. Editing a sent quote creates a new version and voids the old public link.

## 7. External systems

| System | Status | What is known | Reference |
| --- | --- | --- | --- |
| HaloPSA | Ready | REST. `/Item`, `/Client`, `/Opportunities`, `/Quotation`, `/Quotation/Lines`, `/Quotation/Approval`, `/SalesOrder`, outbound webhooks. Auth scheme to confirm in WP0. | https://kb.dtctoday.com/books/halopsa-api-reference/page/quote-endpoints |
| Benji Pays | Ready | Merchant API `https://api.benjipays.com/v2`, header `x-api-key`. `POST /v2/payment-links/unapplied` returns `url` and `expiresAt`. `GET /v2/transactions` for polling. OpenAPI spec and `llms.txt` on the developer site. | https://developer.benjipays.com and https://github.com/bpays/benji-pays-agent-plugin |
| D&H | Ready | REST: price and availability, order placement, order status. OAuth2 client credentials, scope `resource.READ`. Token URLs: `https://auth.dandh.net/api/oauth/token` (prod), `https://test.auth.dandh.net/api/oauth/token` (test). | https://dandh.ca/docs/us/api/API_Offerings.pdf |
| Ingram Micro | Ready after app approval (about 2 business days) | Reseller API: catalog search, price and availability, orders, quotes, freight estimate. Sandbox with test data. SDKs under github.com/ingrammicro-xvantage. | https://developer.ingrammicro.com/reseller/getting-started |
| NTS Direct | Waiting on access | Has an API (confirmed by Ryan). Ryan has asked NTS support for access and docs. Coverage unknown. | Docs will be dropped in `docs/api/nts/` |
| Amazon Business | Depends on Amazon | Product Search, Cart, Ordering APIs exist. Access needs an onboarding questionnaire; Amazon assigns roles. Read the Product Search customer experience guidelines before caching or displaying prices. | https://docs.business.amazon.com/docs/onboarding-overview |
| Lenovo Pro | Unlikely | No public API found. Use the manual and CSV adapter. Lenovo hardware is also available through Ingram and D&H. | none |

Benji Pays specifics:
- A deposit paid before an invoice exists is "unapplied" in Benji Pays until a person applies it to the invoice. Record the payment, show it on the quote, and flag it until someone marks it applied.
- Whether the Merchant API sends webhooks is unconfirmed. Check the OpenAPI spec in WP0. Polling is the fallback.

## 8. Scope

In v1:
- Entra sign-in, two roles.
- Halo read sync (clients, sites, contacts, items, opportunities) by webhook plus scheduled pull.
- Unified catalog search across Halo items, D&H, Ingram Micro, and the manual/CSV source.
- Quote builder: sections, one-time and recurring lines, optional lines, bundles, markup rules, margin view, tax, cost snapshot.
- Templates for cover text, terms and bundles.
- Public quote page at a tokenized URL, PDF, optional-line selection, typed-name acceptance with audit record.
- Benji Pays deposit (full or percentage) from the quote page.
- Halo write-back: quotation on send, status update on accept, one-click sales order.
- Sync issues queue with retry.
- NTS Direct adapter (WP13) if access arrives in time.

Not in v1:
- Placing distributor orders or creating Halo purchase orders.
- Amazon Business and Lenovo Pro live adapters.
- Adding recurring lines to Halo contracts automatically.
- Storefront, whitespace reporting, approval chains.
- Migrating historical Salesbuildr quotes.

## 9. Work packages

Each package is one subagent, one branch, one worktree. A subagent edits only its "Owns" paths.

| ID | Package | Depends on | Owns | Done when |
| --- | --- | --- | --- | --- |
| WP0 | API discovery spikes | Credentials | `docs/api/*`, `fixtures/*` | One note and scrubbed request/response fixtures per API: Halo, Benji Pays, D&H, Ingram |
| WP1 | Foundation | none | repo root, `src/db`, `src/auth`, CI | Preview deploy works, Entra sign-in works, all 14 tables migrate, CI green |
| WP2 | Core contracts | WP1 | `src/core` | Interfaces, shared types, money helpers, outbox worker, with tests |
| WP3 | Halo read sync | WP0, WP2 | `src/integrations/halo/read`, `src/jobs/halo-sync` | Loads all five record types from fixtures; webhook route updates one record; full resync is idempotent |
| WP4 | D&H adapter | WP0, WP2 | `src/integrations/dandh` | Contract tests pass against fixtures; token cached and refreshed |
| WP5 | Ingram adapter | WP0, WP2 | `src/integrations/ingram` | Same contract tests pass against sandbox fixtures |
| WP6 | Manual and CSV adapter | WP2 | `src/integrations/manual` | CSV import with column mapping; single hand-entered line |
| WP7 | Catalog search | WP3-WP6 | `src/catalog`, `app/(app)/catalog` | Fan-out to all adapters, merge on part number, partial results when a source fails |
| WP8 | Quote builder | WP2, WP7 | `src/quotes`, `app/(app)/quotes` | Full builder; totals and margin match a hand-checked fixture |
| WP9 | Public page, PDF, acceptance | WP8 | `app/q/[token]`, `src/pdf`, `src/acceptance` | Renders without sign-in; PDF matches page; acceptance writes audit record and emails both parties |
| WP10 | Benji Pays | WP0, WP9 | `src/integrations/benji`, `src/jobs/payments` | Pay button mints a link at click time; payment recorded against the quote reference; no link stored or emailed |
| WP11 | Halo write-back | WP3, WP8, WP9 | `src/integrations/halo/write` | Quotation with lines on send; status on accept; one-click sales order; new items created in Halo first; failures in issues queue |
| WP12 | Hardening and cutover | all | `e2e/`, `docs/runbook.md` | E2E covers search to paid deposit; runbook and admin settings exist; three real quotes run in parallel with Salesbuildr |
| WP13 | NTS Direct adapter | WP2, NTS docs | `src/integrations/nts` | Same contract tests as WP4. Blocked until docs arrive. |

## 10. Wave order

1. Wave 0: WP0 and WP1 in parallel. WP0 is the only package that calls real APIs.
2. Wave 1: WP2, done by the lead agent itself.
3. Wave 2: WP3, WP4, WP5, WP6 in parallel. Add WP13 if NTS docs have arrived.
4. Wave 3: WP7, then WP8.
5. Wave 4: WP9, then WP10 and WP11 in parallel.
6. Wave 5: WP12. Run WP13 after this if it was still blocked.

If credentials for WP0 are missing, do not wait: run WP1, WP2 and WP6, then build WP8 against the manual adapter only.

## 11. Subagent brief template

```text
Goal: <one sentence from the Package column>
Read first: AGENT_HANDOFF.md sections 3, 5, 6; src/core/*; docs/api/<relevant>.md
You may edit only: <Owns paths>
Do not: change src/core, add dependencies without listing them, call live APIs in tests, commit secrets
Done when: <Done when column>, plus pnpm lint, typecheck and test pass
Return: files changed, test output, open questions, anything you could not verify
```

## 12. Lead agent checklist per returned branch

- Run lint, typecheck and tests yourself. Do not accept a pasted result.
- Read the diff. Confirm no file outside the package's paths changed.
- Spawn one fresh review subagent to look for bugs and missing requirements. Send findings back to the author.
- Merge, then append one line to `docs/decisions.md` for every decision made.
- Report to Ryan in plain terms: what works, what failed, what was skipped.

## 13. Blocked on Ryan

Ask for these at the start. The first six unblock WP0 and WP1.

- [ ] GitHub repo under `integrid-int`, a Vercel or Railway project, a Postgres database
- [ ] Entra ID app registration for sign-in, plus `Mail.Send` on the shared mailbox
- [ ] HaloPSA API application (client ID and secret) on a dedicated agent with rights to clients, items, opportunities, quotations and sales orders; a sandbox or test client if possible
- [ ] Benji Pays API key (Settings, API Keys)
- [ ] D&H API Portal application (client ID and secret)
- [ ] Ingram Micro developer account and app registration (Product Catalog, Orders)
- [ ] Amazon Business onboarding questionnaire submitted
- [ ] NTS Direct API access and docs (requested from NTS support)
- [ ] Three or four recent Salesbuildr quote PDFs for templates and total checks
- [ ] Decisions: default deposit percentage, markup rules by category, who may send without review, quote terms text

## 14. Open questions to resolve in WP0

1. Halo: exact auth flow, and the real `POST /Quotation` and `/Quotation/Lines` payloads. Capture them by creating a quote in the Halo UI and reading it back.
2. Halo: does the API convert a quotation to a sales order, or must the sales order be posted separately?
3. Benji Pays: request fields for an unapplied payment link, and whether webhooks exist.
4. D&H and Ingram: rate limits, and whether keyword catalog search is available on D&H or only lookup by SKU.
5. NTS Direct: what the API covers (search, price and stock, ordering).

## 15. First actions

1. Confirm with Ryan which items in section 13 are ready and which host to use.
2. Create the repo, add this file and `docs/plan.md`, start `docs/decisions.md`.
3. Launch WP1, and WP0 for every API that has credentials.
4. Do WP2 yourself as soon as WP1 merges.
