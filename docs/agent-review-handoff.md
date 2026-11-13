# QUOTEWRIGHT_IMPLEMENTATION_REVIEW

```yaml
document_type: agent_review_handoff
audience: implementing_reviewer_model
recipient: plan_author
plan_author_context: Recipient wrote AGENT_HANDOFF.md and the work-package plan. Do not re-derive the product. Judge the implementation against that plan.
generated_at: 2026-11-13T02:50:00Z
generated_for_tz: America/New_York
repo: integrid-int/salesblaster4000
branch: cursor/quotewright-start-0f44
base: main
implementation_head: dcf632347c4476032541c4c6397637a5b05c04c4
review_tree: implementation_head
note: This file is committed after implementation_head. Review that tree. Ignore this file as product code.
pr: https://github.com/integrid-int/salesblaster4000/pull/1
pr_number: 1
task: review
implement: false
```

## 0. Operating contract

You are reviewing an implementation of your plan. This file is orientation. It is not evidence.

Authority order, highest first:

1. Source, tests, and migrations at `head`. If this file disagrees with the code, the code wins. Record the disagreement as a handoff defect.
2. `AGENT_HANDOFF.md` section 3 (hard rules) and section 9 (done-when). A later Ryan instruction overrides a hard rule only when `docs/decisions.md` records that instruction.
3. `docs/decisions.md`.
4. `docs/plan.md`. It is a copy of the execution plan because the Claude artifact URL returned no readable body on 2026-11-12. It has drifted. Do not treat it as canonical where it conflicts with 1–3.
5. This file.

Do not:

- Implement, refactor, or open a follow-up patch unless a later human instruction says to.
- Invent Halo, Benji Pays, D&H, Ingram, NTS, or Microsoft Graph request or response fields.
- Treat absent credentials as permission to stub live HTTP.
- Print secret values. Names of environment variables are in scope. Values are not.
- Score branding, copy tone, or visual polish except where it hides a behavior bug.
- Mark a package done because a table or interface exists. Use the done-when column.

Required output: section 8, and nothing else before it. One YAML document. No prose preface.

## 1. Repository coordinates

```yaml
package_manager: pnpm@10.33.4
node_ci: 22
framework: next@16.4.6
react: 19.3.0
orm: drizzle-orm@0.45.4
auth: next-auth@5.0.0-beta.32
tests: vitest@5.1.0
db_dev_without_DATABASE_URL: "@electric-sql/pglite in .data/pglite"
db_when_DATABASE_URL_set: postgres via pg.Pool
migrations: drizzle/0000_init.sql
migration_runner: applied on first getDb() in src/db/client.ts
app_router: true
proxy: proxy.ts
middleware_ts: absent
shadcn: not initialized
e2e_dir: absent
fixtures_dir: fixtures/quotes/hand-checked-totals.json only
docs_api: docs/api/README.md only
```

Commits on the branch after `main` (`5c8c290`):

```text
04b52de Build the Quotewright foundation and manual quote path.
eb9c475 Let CI take the pnpm version from package.json.
6adf0a2 Record the Railway preview.
52ddbed Note that the Railway preview no longer waits on Vercel.
dcf6323 Turn on the development email form for the Railway preview.
```

Gate command, from repo root:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Last local run observed by the implementer, before `dcf6323` was pushed: lint clean, typecheck clean, vitest 10 files, 29 tests passed. Re-run it. Do not accept this sentence as the result.

CI workflow: `.github/workflows/ci.yml`. `pnpm/action-setup@v4` reads `packageManager` from `package.json`. An earlier run failed because the workflow also pinned `version: 10`. That pin was removed in `eb9c475`. CI on `eb9c475` was observed green (push and pull_request). CI on `dcf6323` was not re-checked for this file. Query GitHub checks for `head` before scoring WP1.

## 2. Why the build stopped where it did

`AGENT_HANDOFF.md` section 10, final paragraph: if WP0 credentials are missing, do not wait; run WP1, WP2, and WP6, then build WP8 against the manual adapter only.

Observed credential state at implementation time: no Halo, Benji Pays, D&H, Ingram, NTS docs, or Entra app registration in the environment. No live calls were made. No request or response fixtures were invented. `docs/api/README.md` records that.

Ryan later instructed two hosting changes. Both are recorded in `docs/decisions.md`:

- Preview host is Railway, not a Vercel project. URL: `https://quotewright-production.up.railway.app`.
- `AUTH_DEV_BYPASS=1` is set on that Railway service, including while `NODE_ENV=production`.

Those two instructions are overrides. Judge the code that implements them. Do not recommend reverting them unless the implementation is broader than the instruction.

## 3. Package ledger

Status values: `blocked`, `not_started`, `partial`, `claim_meets_done_when`. The status column is the implementer's claim. Your status column replaces it.

| id | claim | done_when gap to verify | evidence |
| --- | --- | --- | --- |
| WP0 | blocked | No scrubbed fixtures for Halo, Benji, D&H, Ingram. | `docs/api/README.md`. No `fixtures/` API captures. |
| WP1 | partial | Preview is up on Railway. Entra provider is coded. Live Entra sign-in has not succeeded: client id, secret, and tenant id are unset. 14 tables migrate in `src/db/schema.test.ts`. CI green must be re-checked at `head`. | `src/db/schema.ts`, `src/auth/index.ts`, `proxy.ts`, `.github/workflows/ci.yml` |
| WP2 | claim_meets_done_when | `Payment` and `PaymentProvider` exist and are explicitly unfinished. No Benji field names were added. | `src/core/types.ts`, `src/core/money.ts`, `src/core/outbox.ts`, tests beside them |
| WP3 | blocked | `src/integrations/halo/` does not exist. | |
| WP4 | blocked | `src/integrations/dandh/` does not exist. | |
| WP5 | blocked | `src/integrations/ingram/` does not exist. | |
| WP6 | claim_meets_done_when | CSV column mapping and one hand-entered line. | `src/integrations/manual/csv.ts`, `src/integrations/manual/adapter.ts`, `app/(app)/catalog/` |
| WP7 | partial | Fan-out, timeout isolation, and MPN merge are implemented. The only registered adapter is `manual`. Done-when says all adapters. | `src/catalog/search.ts`, `src/catalog/registry.ts`, `src/catalog/search.test.ts` |
| WP8 | partial | Draft builder, sections, billing periods, optional lines, cost snapshot, markup, minimum margin, and `fixtures/quotes/hand-checked-totals.json` exist. Not present: send, version bump, voided public token, bundles, template application, cover text, terms text, tax-code mapping. | `src/quotes/`, `app/(app)/quotes/` |
| WP9 | not_started | No `app/q/[token]`, no `src/pdf`, no `src/acceptance`. `quotes.public_token` is generated at draft creation. `proxy.ts` allows `/q/` and that path 404s. | |
| WP10 | not_started | No `src/integrations/benji`, no `src/jobs/payments`. No payment link is minted or stored. `payments` table exists and is unused. | |
| WP11 | not_started | No `src/integrations/halo/write`. Outbox drain is called with an empty handler map. | `app/api/jobs/outbox/route.ts` |
| WP12 | not_started | No `e2e/`, no `docs/runbook.md`. | |
| WP13 | blocked | No `docs/api/nts/`, no `src/integrations/nts`. | |

V1 scope from `AGENT_HANDOFF.md` section 8 that has no code path yet: templates for cover, terms, and bundles; public page; PDF; acceptance email; Benji deposit; Halo quotation on send; status on accept; one-click sales order; sync issues queue UI; webhook plus scheduled Halo pull.

## 4. Plan-to-code deltas

These are intentional representation changes. Judge whether each preserves the plan invariant.

```yaml
deltas:
  - id: D1
    plan: "Money is integer cents. Rates in the plan text are percents (markupPercent, depositPercent)."
    code: "Money stays integer cents. Markup, minimum margin, deposit, and tax are integer basis points. 2000 = 20%. Quantity is integer milli-units. 1500 = 1.5. qty column is qty_milli. deposit column is deposit_bps. pricing_rules columns are markup_bps and min_margin_bps."
    files: [src/core/money.ts, src/db/schema.ts, docs/decisions.md]
    invariant_to_check: "Half-up rounding via BigInt. Minimum-margin price uses ceil division so the realized margin cannot land under the floor. marginBps is margin on selling price: (price-cost)/price."
  - id: D2
    plan: "Hosting default Vercel. Cron hits job routes."
    code: "App runs on Postgres when DATABASE_URL is set and on PGlite when it is unset. vercel.json cron targets GET or POST /api/jobs/outbox. The running preview is Railway project quotewright, service quotewright, environment production. Railway is not invoking that cron. CRON_SECRET was not set on the Railway service by the implementer."
    ids:
      railway_project_id: 5f0146e6-069b-4bf5-b1cc-c9bd6a13c598
      railway_service_id: 97007ccc-3187-4142-b0cb-1740f5d8bae8
      railway_postgres_service_id: b760dcdd-cb7d-448f-8388-604aaea8efdc
      railway_environment_id: a3de0cb6-4b8c-4c70-b683-18882485b19b
      public_url: https://quotewright-production.up.railway.app
      deployment_initial_success: 58394ff1-e181-490a-bebc-0bbb410736ff
      deployment_dev_email_success: 95655c84-7729-4dfb-9366-7a599a8bb667
  - id: D3
    plan: "AUTH_DEV_BYPASS only when NODE_ENV is not production."
    code: "devBypassAllowed is AUTH_DEV_BYPASS === '1' with no NODE_ENV check. Railway production has AUTH_DEV_BYPASS=1. Form accepts only /^[^\\s@]+@integrid\\.net$/. No password. QUOTEWRIGHT_ADMIN_EMAILS=ryan@integrid.net, so that address is role admin. Any other @integrid.net address is role seller."
    files: [src/auth/policy.ts, src/auth/index.ts, app/login/page.tsx]
  - id: D4
    plan: "Sample rows only when bypass is on and DATABASE_URL is unset. Production does not seed."
    code: "src/db/client.ts calls seedSampleData on both the PGlite path and the Postgres path when devBypassAllowed. Seed is idempotent per missing client, missing default pricing rule, and missing manual SKU. The older decision paragraph in docs/decisions.md still says production does not seed. The later decision says sample rows are inserted when the switch is on and rows are missing. Treat the later paragraph plus client.ts as the implementation. Flag the stale paragraph if you consider the doc drift a defect."
    seed_identity:
      halo_client_id: [900001, 900002]
      names: ["Northwind Clinic (sample)", "Harbor School District (sample)"]
      skus: ["FG-60F", "BCK-M"]
      pricing: { markup_bps: 2000, min_margin_bps: 1000 }
  - id: D5
    plan: "Payment shape comes from a WP0 fixture."
    code: "Payment is { id, amountCents, status }. Comment in src/core/types.ts says WP10 must align it to a captured response before storing more."
  - id: D6
    plan: "shadcn/ui."
    code: "Server-rendered Tailwind forms. No shadcn init. Decision says these screens do not need a dialog or menu library."
  - id: D7
    plan: "normalized manufacturer part number merge."
    code: "normalizeMpn keeps uppercase A-Z and 0-9. Empty result is null. Null MPN does not merge; key is solo:{source}:{sourceSku}. Offers inside a product sort by costCents ascending, nulls last. Description kept is the longest. Manufacturer fills only when the group has none."
    files: [src/core/mpn.ts, src/catalog/search.ts]
  - id: D8
    plan: "Outbox terminal failure remains visible."
    code: "Status enum is pending, processing, succeeded, dead. Missing handler throws. Default maxAttempts is 8. Backoff is min(15 minutes, 2^attempts seconds). Claim uses FOR UPDATE SKIP LOCKED. recoverStuck returns processing rows older than the cutoff to pending. The cron route uses a 15 minute cutoff and handlers {}. A job with no handler therefore retries and then stays dead."
    files: [src/core/outbox.ts, app/api/jobs/outbox/route.ts]
```

## 5. Behavior that exists

Auth:

- `src/auth/index.ts` registers Microsoft Entra ID only when client id, secret, and tenant id are all set. Issuer is `AUTH_MICROSOFT_ENTRA_ID_ISSUER` or `https://login.microsoftonline.com/{tenant}/v2.0`. `signIn` callback rejects a token whose `tid` does not match the configured tenant, or whose profile lacks `oid` or an email. Email is `email` or `preferred_username`.
- Dev credentials provider id is `dev-bypass`. `authorize` re-checks `devBypassAllowed` and `devBypassEmail`.
- Session strategy is JWT. `trustHost: true`. Pages `signIn` and `error` are `/login`.
- `app/(app)/layout.tsx` calls `auth()` and redirects to `/login` when `session.user.id` is missing. `proxy.ts` additionally redirects to `/login` when neither `authjs.session-token` nor `__Secure-authjs.session-token` is present. Public prefixes: `/login`, `/api/auth`, `/api/jobs`, `/q/`. Cookie presence is not validation. The layout check is the session check.
- First admin list is `QUOTEWRIGHT_ADMIN_EMAILS`. Role is applied on sign-in, not continuously.

Quotes:

- `createDraftQuote` allocates `Q-####` by scanning existing `quotes.number` inside a transaction that takes `pg_advisory_xact_lock(8723641)`. Inserts `publicToken` from 32 random bytes, base64url. `depositBps` defaults to 0. Status defaults to `draft`.
- Edits call `requireDraft`. Non-draft quotes throw `QuoteError`.
- `addCatalogLine` snapshots `catalog_items.cost_cents` onto the line and sets price from `suggestUnitPrice` using the `default` pricing rule. Null cost is rejected for catalog lines.
- `addHandEnteredLine` writes a manual catalog row, then a line. Seller price below `priceForMinMargin` throws. Admin bypasses that floor. Null cost skips the floor. The catalog insert is not in the same transaction as the line insert.
- `updateLine` re-checks the floor when a price is submitted. Optional and selected are independent booleans.
- New catalog and hand-entered lines set `selected: true` even when `optional` is true. Totals include a line when `!optional || selected` (`src/quotes/totals.ts`). An optional line is therefore included until something sets `selected` false.
- Sellers cannot `saveDefaultPricingRule`. Admins can. Markup allowed 0% through 1000% (0 through 100000 bps). Minimum margin must be under 100% (under 10000 bps).
- Hand-checked fixture `fixtures/quotes/hand-checked-totals.json`: markup 2000 bps, min margin 1000 bps, tax 0. Once price 48000 cents, cost 40000, margin 1667 bps. Monthly price 9000, cost 7500, margin 1667. Annual empty, margin null. Optional unselected line C is excluded. Optional selected line D is included. There is a separate browser observation, not in that fixture: two units at cost 62000 cents priced at 74400 each, extended 148800 cents, margin 1667 bps. Recompute before relying on it.

Catalog:

- `catalogAdapters` returns only `createManualAdapter(db)`.
- `searchCatalog` runs adapters with `Promise.all` and a per-adapter timeout default 8000 ms. A thrown or timed-out adapter becomes `failures[]` and does not drop successes.
- CSV parser in `src/integrations/manual/csv.ts` handles BOM, quotes, and doubled quotes. Column names come from the submitted mapping, not from a fixed header set.

Live preview, observed after deployment `95655c84-7729-4dfb-9366-7a599a8bb667`:

```yaml
observations:
  - GET /login returned 200 and rendered the email form plus the Entra-not-configured notice.
  - GET /quotes with no session ended at /login.
  - Submit email not-integrid@example.com stayed on /login.
  - Submit email ryan@integrid.net ended at /quotes with visible role text "ryan@integrid.net · admin".
  - Quotes page listed clients "Northwind Clinic (sample)" and "Harbor School District (sample)".
  - Default pricing rule text showed markup 20% and minimum margin 10%.
  - No quote rows existed at that observation.
```

Re-check the live URL if you need current behavior. The database is shared and mutable.

## 6. Behavior that does not exist

Do not file these as surprises. File them only if you believe the credential-free stop line was violated, or if a done-when claim above is false.

- No Halo read, webhook, or write.
- No distributor adapter, token cache, or order call.
- No Benji link, webhook, or poll.
- No public quote page, PDF render, acceptance insert, or email send.
- No quote status transition out of `draft`.
- No new version and no public-token rotation.
- No bundle model beyond sections and lines.
- No template read or write UI. The `templates` table is migrated and covered by the schema insert test.
- No tax rate other than the stored `tax_bps` default 0.
- No per-quote authorization. Any signed-in user who can hit a server action can address any draft id the action accepts. Confirm or reject that reading in `app/(app)/quotes/[id]/actions.ts` and `src/quotes/commands.ts`.
- No issues-queue UI. Dead outbox rows are only visible by querying `outbox`.
- No Railway cron. Outbox on the preview does not drain unless something calls `/api/jobs/outbox` with `Authorization: Bearer $CRON_SECRET`.

## 7. Review targets

Investigate. Each item is a hypothesis. Confirm, reject, or downgrade it from the code. Do not copy the hypothesis into `defects` without a file and the failing condition.

```yaml
targets:
  - id: T1
    question: "Does addHandEnteredLine leave a catalog row when the following line insert fails or the section is not a draft?"
    files: [src/quotes/commands.ts]
  - id: T2
    question: "Can nextQuoteNumber duplicate or skip under two concurrent transactions, given it scans all numbers in memory after the advisory lock? Is the lock id shared with anything else?"
    files: [src/quotes/commands.ts]
  - id: T3
    question: "Is cookie-only gating in proxy.ts a problem, given layout.tsx calls auth()? Does any route under the matcher skip the layout and also skip auth()?"
    files: [proxy.ts, app/(app)/layout.tsx, app/api]
  - id: T4
    question: "Does optional=true and selected=true on insert contradict the plan's optional-line default? The totals function itself is consistent with selected."
    files: [src/quotes/commands.ts, src/quotes/totals.ts, app/(app)/quotes/[id]/page.tsx]
  - id: T5
    question: "Does a seller updating a line with a null unit_cost_cents bypass the minimum margin because assertPriceAllowed returns early on null cost?"
    files: [src/quotes/commands.ts]
  - id: T6
    question: "Is the public Railway dev form reachable by anyone on the internet, and is that exactly the recorded Ryan instruction rather than an accident?"
    files: [src/auth/policy.ts, docs/decisions.md]
  - id: T7
    question: "Does seedSampleData on the Postgres path violate 'never make Quotewright the master for clients' or only insert labeled cache stand-ins? Is there a create-client action?"
    files: [src/db/seed.ts, src/db/client.ts, app]
  - id: T8
    question: "Does drainOutbox with handlers {} fail closed, or can a job be marked succeeded without a handler?"
    files: [src/core/outbox.ts, app/api/jobs/outbox/route.ts]
  - id: T9
    question: "Are money helpers safe for negative cents, 0 price, and min margin 0 and 9999 bps? Tests exist in src/core/money.test.ts. Look for untested edges, not for a rewrite."
    files: [src/core/money.ts, src/core/money.test.ts]
  - id: T10
    question: "Does docs/plan.md still say the hosting target is Vercel and that a Vercel project is outstanding, in contradiction with docs/decisions.md?"
    files: [docs/plan.md, docs/decisions.md]
  - id: T11
    question: "Does the schema test prove migration of all 14 names, or only that those Drizzle tables can insert?"
    files: [src/db/schema.test.ts, drizzle/0000_init.sql]
  - id: T12
    question: "Is acceptances.pdf_sha256 NOT NULL going to block WP9 if a row must be written before a PDF hash exists? Do not design WP9. Only say whether the column contradicts the plan's acceptance record."
    files: [src/db/schema.ts, AGENT_HANDOFF.md]
```

Test files present:

```text
src/auth/policy.test.ts
src/core/money.test.ts
src/core/mpn.test.ts
src/core/outbox.test.ts
src/db/schema.test.ts
src/quotes/commands.test.ts
src/quotes/totals.test.ts
src/catalog/search.test.ts
src/integrations/manual/adapter.test.ts
src/integrations/manual/csv.test.ts
```

No Playwright suite exists. Do not require one for this review.

## 8. Required output

Emit one YAML document with exactly these keys. Use `[]` when a list is empty. `evidence` is a repo-relative path plus a symbol or line-level description. Do not quote secrets. Do not include a remediation patch.

```yaml
head_reviewed: ""
commands_run:
  - cmd: ""
    exit_code: 0
    result: ""
verdict: accept_with_gaps # accept | accept_with_gaps | reject
verdict_reason: ""
package_status:
  WP0: blocked
  WP1: partial
  WP2: partial
  WP3: blocked
  WP4: blocked
  WP5: blocked
  WP6: partial
  WP7: partial
  WP8: partial
  WP9: not_started
  WP10: not_started
  WP11: not_started
  WP12: not_started
  WP13: blocked
plan_deltas:
  - id: D1
    judgment: faithful # faithful | acceptable_deviation | defect
    note: ""
defects:
  - id: ""
    severity: low # low | medium | high
    target_id: "" # T1–T12 or none
    evidence: ""
    condition: ""
    plan_rule: ""
rejected_hypotheses:
  - target_id: ""
    reason: ""
missing_against_done_when:
  - package: ""
    item: ""
do_not_build_yet:
  - item: ""
    reason: ""
doc_drift:
  - path: ""
    conflict: ""
questions_for_ryan: []
handoff_errors:
  - ""
```

`verdict: reject` means a hard rule in `AGENT_HANDOFF.md` section 3 was broken without a recorded Ryan override, or a claimed done-when is false in a way that makes the package unsafe to build on. `accept_with_gaps` is the expected band if WP1 Entra is still unproven and WP7–WP8 are only the manual slice. `accept` means you would let WP9 start on this branch without a corrective commit.

`do_not_build_yet` must include every package that still requires a WP0 fixture or NTS docs. Do not propose payload shapes for them.

`questions_for_ryan` is only for decisions the plan already listed as open: default deposit percentage, markup by category, who may send without review, quote terms text, Halo tax-code mapping. Do not add product ideas.
