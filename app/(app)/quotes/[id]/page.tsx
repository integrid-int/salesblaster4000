import Link from "next/link";
import { notFound } from "next/navigation";
import { searchCatalog } from "@/src/catalog/search";
import { catalogAdapters } from "@/src/catalog/registry";
import { extendedCents, formatPercentFromBps, formatQty, formatUsd } from "@/src/core/money";
import { getDb } from "@/src/db/client";
import { getDefaultPricingRule, getQuote } from "@/src/quotes/queries";
import { buttonClass, dangerButtonClass, inputClass, labelClass, secondaryButtonClass } from "@/src/ui/styles";
import {
  addCatalogLineAction,
  addHandLineAction,
  addSectionAction,
  removeLineAction,
  updateLineAction,
} from "./actions";

function dollarInput(cents: number): string {
  const absolute = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

export default async function QuoteBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
}) {
  const { id } = await params;
  const { q = "", error } = await searchParams;
  const db = await getDb();
  const quote = await getQuote(db, id);
  if (!quote) notFound();
  const rule = await getDefaultPricingRule(db);
  const search = q.trim() ? await searchCatalog(catalogAdapters(db), q, { limit: 8 }) : null;
  const firstSection = quote.sections[0];

  return (
    <div className="grid gap-8">
      <div>
        <p className="text-sm text-muted">
          <Link className="underline" href="/quotes">
            Quotes
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {quote.number} · {quote.client.name}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Draft version {quote.version}. Tax {formatPercentFromBps(quote.taxBps)} because Halo tax
          codes are not mapped. Deposit {formatPercentFromBps(quote.depositBps)}. Sending this quote
          is not built yet.
        </p>
      </div>
      {error ? <p className="rounded-md border border-line bg-card px-3 py-2 text-sm text-danger">{error}</p> : null}
      <section className="grid gap-3 rounded-lg border border-line bg-card p-4 sm:grid-cols-3">
        {(["once", "monthly", "annual"] as const).map((billing) => {
          const group = quote.totals.groups[billing];
          const label = billing === "once" ? "One-time" : billing === "monthly" ? "Monthly" : "Annual";
          return (
            <div key={billing}>
              <h2 className="text-sm text-muted">{label}</h2>
              <p className="text-xl font-semibold tabular-nums">{formatUsd(group.priceCents)}</p>
              <p className="text-sm tabular-nums text-muted">
                Cost {formatUsd(group.costCents)}
                {group.marginBps === null ? "" : ` · margin ${formatPercentFromBps(group.marginBps)}`}
                {group.taxCents ? ` · tax ${formatUsd(group.taxCents)}` : ""}
              </p>
            </div>
          );
        })}
      </section>
      <form action={addSectionAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="quoteId" value={quote.id} />
        <label className={`${labelClass} min-w-64 flex-1`}>
          New section
          <input className={inputClass} name="title" placeholder="Equipment" required />
        </label>
        <button className={secondaryButtonClass} type="submit">
          Add section
        </button>
      </form>
      {quote.sections.map((section) => (
        <section key={section.id} className="grid gap-4">
          <h2 className="text-lg font-medium">{section.title}</h2>
          <div className="rounded-lg border border-line bg-card">
            {section.lines.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted">No lines in this section.</p>
            ) : (
              section.lines.map((line) => (
                <div key={line.id} className="grid gap-3 border-b border-line px-4 py-4 last:border-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{line.description}</p>
                      <p className="text-xs text-muted">
                        Cost snapshot {line.unitCostCents === null ? "unknown" : formatUsd(line.unitCostCents)}
                      </p>
                    </div>
                    <p className="text-sm font-medium tabular-nums">
                      {formatUsd(extendedCents(line.unitPriceCents, line.qtyMilli))}
                    </p>
                  </div>
                  <form action={updateLineAction} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <input type="hidden" name="lineId" value={line.id} />
                    <label className={labelClass}>
                      Qty
                      <input className={`${inputClass} w-24`} name="qty" defaultValue={formatQty(line.qtyMilli)} />
                    </label>
                    <label className={labelClass}>
                      Unit price
                      <input className={`${inputClass} w-32`} name="price" defaultValue={dollarInput(line.unitPriceCents)} />
                    </label>
                    <label className={labelClass}>
                      Billing
                      <select className={inputClass} name="billing" defaultValue={line.billing}>
                        <option value="once">One-time</option>
                        <option value="monthly">Monthly</option>
                        <option value="annual">Annual</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 pb-2 text-sm">
                      <input type="checkbox" name="optional" defaultChecked={line.optional} />
                      Optional
                    </label>
                    <label className="flex items-center gap-2 pb-2 text-sm">
                      <input type="checkbox" name="selected" defaultChecked={line.selected} />
                      Selected
                    </label>
                    <button className={secondaryButtonClass} type="submit">
                      Update
                    </button>
                  </form>
                  <form action={removeLineAction}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <input type="hidden" name="lineId" value={line.id} />
                    <button className={dangerButtonClass} type="submit">
                      Remove
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </section>
      ))}
      <section className="grid gap-4 rounded-lg border border-line bg-card p-4">
        <h2 className="font-medium">Add from the catalog</h2>
        <p className="text-sm text-muted">
          Pricing rule:{" "}
          {rule
            ? `${formatPercentFromBps(rule.markupBps)} markup, ${formatPercentFromBps(rule.minMarginBps)} minimum margin.`
            : "none, so catalog lines are priced at cost."}
        </p>
        <form className="flex flex-wrap items-end gap-3" action={`/quotes/${quote.id}`}>
          <label className={`${labelClass} min-w-64 flex-1`}>
            Search
            <input className={inputClass} name="q" defaultValue={q} placeholder="firewall, SKU, or part number" />
          </label>
          <button className={secondaryButtonClass} type="submit">
            Search
          </button>
        </form>
        {search?.failures.length ? (
          <p className="text-sm text-danger">
            {search.failures.map((failure) => `${failure.source}: ${failure.message}`).join(" ")}
          </p>
        ) : null}
        {search && search.products.length === 0 ? <p className="text-sm text-muted">No matches.</p> : null}
        {search?.products.map((product) => (
          <div key={product.key} className="border-t border-line pt-3">
            <p className="font-medium">{product.description}</p>
            <p className="text-xs text-muted">{product.mfrPartNumber ?? "No manufacturer part number"}</p>
            {firstSection ? (
              product.offers.map((offer) => (
                <form
                  key={`${offer.source}:${offer.sourceSku}`}
                  action={addCatalogLineAction}
                  className="mt-2 flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="quoteId" value={quote.id} />
                  <input type="hidden" name="sectionId" value={firstSection.id} />
                  <p className="text-sm">
                    {offer.source} {offer.sourceSku} ·{" "}
                    {offer.costCents === null ? "no cost" : formatUsd(offer.costCents)}
                    {offer.stock === null ? "" : ` · stock ${offer.stock}`}
                  </p>
                  <CatalogItemId offerSource={offer.source} offerSku={offer.sourceSku} />
                </form>
              ))
            ) : (
              <p className="mt-2 text-sm text-muted">Add a section before adding a line.</p>
            )}
          </div>
        ))}
      </section>
      {firstSection ? (
        <section className="rounded-lg border border-line bg-card p-4">
          <h2 className="font-medium">Hand-entered line</h2>
          <form action={addHandLineAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="quoteId" value={quote.id} />
            <input type="hidden" name="sectionId" value={firstSection.id} />
            <label className={labelClass}>
              SKU
              <input className={inputClass} name="sku" required />
            </label>
            <label className={labelClass}>
              Description
              <input className={inputClass} name="description" required />
            </label>
            <label className={labelClass}>
              Manufacturer part
              <input className={inputClass} name="mpn" />
            </label>
            <label className={labelClass}>
              Manufacturer
              <input className={inputClass} name="manufacturer" />
            </label>
            <label className={labelClass}>
              Unit cost
              <input className={inputClass} name="cost" placeholder="100.00" />
            </label>
            <label className={labelClass}>
              Unit price
              <input className={inputClass} name="price" placeholder="120.00" required />
            </label>
            <label className={labelClass}>
              Quantity
              <input className={inputClass} name="qty" defaultValue="1" />
            </label>
            <label className={labelClass}>
              Billing
              <select className={inputClass} name="billing" defaultValue="once">
                <option value="once">One-time</option>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="optional" /> Optional
            </label>
            <button className={buttonClass} type="submit">
              Add line to {firstSection.title}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}

async function CatalogItemId({ offerSource, offerSku }: { offerSource: string; offerSku: string }) {
  const { catalogItems } = await import("@/src/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const db = await getDb();
  const [row] = await db
    .select({ id: catalogItems.id })
    .from(catalogItems)
    .where(and(eq(catalogItems.source, offerSource), eq(catalogItems.sourceSku, offerSku)))
    .limit(1);
  if (!row) return <p className="text-sm text-muted">This offer is not saved locally.</p>;
  return (
    <>
      <input type="hidden" name="catalogItemId" value={row.id} />
      <label className={labelClass}>
        Qty
        <input className={`${inputClass} w-20`} name="qty" defaultValue="1" />
      </label>
      <label className={labelClass}>
        Billing
        <select className={inputClass} name="billing" defaultValue="once">
          <option value="once">One-time</option>
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="optional" /> Optional
      </label>
      <button className={buttonClass} type="submit">
        Add
      </button>
    </>
  );
}
