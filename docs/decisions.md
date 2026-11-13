# Decisions

## 2026-11-12 — Hosting target is Vercel

The handoff default is Vercel. No Vercel project or database was available here, so the app also runs on local PGlite when `DATABASE_URL` is unset and on Postgres when it is set. The outbox drain is `GET` or `POST /api/jobs/outbox`, which matches Vercel Cron. A cron entry is in `vercel.json`. It refuses to run until `CRON_SECRET` is set.

## 2026-11-12 — The live preview is on Railway

Ryan asked for this preview on Railway. The project is `quotewright` in his workspace, with the app service `quotewright` and a private Postgres service. The public URL is https://quotewright-production.up.railway.app. Production sign-in is still Entra, and those variables are unset, so the login page says the app registration is missing. `AUTH_DEV_BYPASS` stays off because `NODE_ENV` is production. Railway does not run the Vercel cron, so this preview does not drain the outbox.

## 2026-11-12 — Cache Components stay off

Next.js 16 can turn on Cache Components. Quote pages read the signed-in user on every request, so they are dynamic. The flag is left off until there is a cached public page to justify it.

## 2026-11-12 — Rates are basis points and quantities are milli-units

Money is integer cents. Markup, minimum margin, deposit, and tax are integer basis points (`2000` = 20%). Quantity is integer milli-units (`1500` = 1.5). Line totals use half-up integer division. A minimum-margin price rounds up so the margin cannot land under the floor.

## 2026-11-12 — Development sign-in

`AUTH_DEV_BYPASS=1` shows an email form, and only when `NODE_ENV` is not `production`. The address must be `@integrid.net`. Production sign-in is Microsoft Entra for the tenant in `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`. The issuer is that tenant, not `common`. A token whose `tid` does not match is rejected. The first admin list is `QUOTEWRIGHT_ADMIN_EMAILS`; the example lists `ryan@integrid.net`. Everyone else in the tenant is a seller. Role changes apply on the next sign-in.

## 2026-11-12 — Sample data is not a client master

When the development bypass is on and `DATABASE_URL` is unset, the empty local database gets two cache rows shaped like Halo clients (`halo_client_id` 900001 and 900002), two contacts, two manual catalog items, and a sample pricing rule of 20% markup and 10% minimum margin. There is no create-client action. Those rows are labeled sample. Production does not seed them.

## 2026-11-12 — Tax and deposit stay at zero

Halo tax-code mapping is unknown, so `quotes.tax_bps` is stored on the quote and defaults to 0. No tax rate was invented. Deposit defaults to 0 basis points until Ryan sets a percentage. Sellers cannot save a unit price below the minimum margin. Admins can.

## 2026-11-12 — Outbox terminal state is `dead`

A job with no registered handler fails and retries. After the attempt limit it becomes `dead` and stays in the queue for a person to see. A row left in `processing` for 15 minutes is returned to `pending` by the cron route.

## 2026-11-12 — Payment shape is unfinished

`Payment` on the provider contract has `id`, `amountCents`, and `status` only. Benji field names stay unknown until a WP0 fixture exists. No payment link is created.

## 2026-11-12 — UI kit

Pages are server-rendered Tailwind forms. shadcn/ui is the intended kit and is not initialized yet; these screens do not need a dialog or menu library.

## 2026-11-12 — Normalized part number

`catalog_items.normalized_mpn` is uppercase letters and digits, written when a manual item is saved. Catalog merge uses it. Items with no part number stay separate.

## Open until Ryan decides

- Default deposit percentage
- Markup by category
- Who may send a quote without review
- Quote terms text
- Which Halo tax codes map to which rates
