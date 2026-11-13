import Link from "next/link";
import { formatPercentFromBps, formatUsd } from "@/src/core/money";
import { getDb } from "@/src/db/client";
import { getDefaultPricingRule, listClients, listQuotes } from "@/src/quotes/queries";
import { buttonClass, inputClass, labelClass } from "@/src/ui/styles";
import { createQuoteAction, savePricingRuleAction } from "./actions";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const db = await getDb();
  const [quotes, clients, rule] = await Promise.all([
    listQuotes(db),
    listClients(db),
    getDefaultPricingRule(db),
  ]);
  const markup = rule ? formatPercentFromBps(rule.markupBps).replace("%", "") : "0";
  const minMargin = rule ? formatPercentFromBps(rule.minMarginBps).replace("%", "") : "0";

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Halo, D&amp;H, Ingram, and Benji Pays are not connected. Search uses the manual catalog
          only. Nothing on this page is sent to a client.
        </p>
      </div>
      {error ? <p className="rounded-md border border-line bg-card px-3 py-2 text-sm text-danger">{error}</p> : null}
      <section className="rounded-lg border border-line bg-card p-4">
        <h2 className="font-medium">New draft</h2>
        {clients.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No clients are cached yet. Halo sync has not run.</p>
        ) : (
          <form action={createQuoteAction} className="mt-3 flex flex-wrap items-end gap-3">
            <label className={`${labelClass} min-w-64 flex-1`}>
              Client
              <select className={inputClass} name="clientId" required>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <button className={buttonClass} type="submit">
              Create quote
            </button>
          </form>
        )}
      </section>
      <section className="overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Number</th>
              <th className="px-4 py-2 font-medium">Client</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">One-time</th>
              <th className="px-4 py-2 text-right font-medium">Monthly</th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={5}>
                  No quotes yet.
                </td>
              </tr>
            ) : (
              quotes.map((quote) => (
                <tr key={quote.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link className="font-medium underline" href={`/quotes/${quote.id}`}>
                      {quote.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{quote.client.name}</td>
                  <td className="px-4 py-3 capitalize">{quote.status}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatUsd(quote.totals.groups.once.priceCents)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatUsd(quote.totals.groups.monthly.priceCents)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
      <section className="rounded-lg border border-line bg-card p-4">
        <h2 className="font-medium">Default pricing rule</h2>
        <p className="mt-1 text-sm text-muted">
          {rule
            ? `Markup ${formatPercentFromBps(rule.markupBps)}, minimum margin ${formatPercentFromBps(rule.minMarginBps)}.`
            : "No rule is saved, so new lines are priced at cost."}
        </p>
        <form action={savePricingRuleAction} className="mt-3 flex flex-wrap items-end gap-3">
          <label className={labelClass}>
            Markup %
            <input className={inputClass} name="markup" defaultValue={markup} inputMode="decimal" />
          </label>
          <label className={labelClass}>
            Minimum margin %
            <input className={inputClass} name="minMargin" defaultValue={minMargin} inputMode="decimal" />
          </label>
          <button className={buttonClass} type="submit">
            Save rule
          </button>
        </form>
      </section>
    </div>
  );
}
