import { searchCatalog } from "@/src/catalog/search";
import { catalogAdapters } from "@/src/catalog/registry";
import { formatUsd } from "@/src/core/money";
import { getDb } from "@/src/db/client";
import { buttonClass, inputClass, labelClass, secondaryButtonClass } from "@/src/ui/styles";
import { handEntryAction, importCsvAction } from "./actions";

const sampleCsv = `sku,description,mpn,manufacturer,cost,msrp,stock
SW-24,24-port switch,SW-24,Acme,420.00,699.00,6`;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; notice?: string }>;
}) {
  const { q = "", notice } = await searchParams;
  const db = await getDb();
  const result = q.trim() ? await searchCatalog(catalogAdapters(db), q) : null;

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Manual and CSV items only. Distributor search stays off until those APIs have recorded
          fixtures. A product quoted from here is still created in Halo before a quote is pushed.
        </p>
      </div>
      {notice ? <p className="rounded-md border border-line bg-card px-3 py-2 text-sm">{notice}</p> : null}
      <form className="flex flex-wrap items-end gap-3" action="/catalog">
        <label className={`${labelClass} min-w-64 flex-1`}>
          Search
          <input className={inputClass} name="q" defaultValue={q} placeholder="firewall, SKU, or part number" />
        </label>
        <button className={buttonClass} type="submit">
          Search
        </button>
      </form>
      {result ? (
        <section className="overflow-x-auto rounded-lg border border-line bg-card">
          {result.failures.length > 0 ? (
            <p className="border-b border-line px-4 py-2 text-sm text-danger">
              {result.failures.map((failure) => `${failure.source}: ${failure.message}`).join(" ")}
            </p>
          ) : null}
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 text-right font-medium">Cost</th>
                <th className="px-4 py-2 text-right font-medium">Stock</th>
              </tr>
            </thead>
            <tbody>
              {result.products.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={4}>
                    No matches.
                  </td>
                </tr>
              ) : (
                result.products.flatMap((product) =>
                  product.offers.map((offer) => (
                    <tr key={`${offer.source}:${offer.sourceSku}`} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <p>{product.description}</p>
                        <p className="text-xs text-muted">{offer.mfrPartNumber ?? offer.sourceSku}</p>
                      </td>
                      <td className="px-4 py-3">
                        {offer.source} · {offer.sourceSku}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {offer.costCents === null ? "—" : formatUsd(offer.costCents)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{offer.stock ?? "—"}</td>
                    </tr>
                  )),
                )
              )}
            </tbody>
          </table>
        </section>
      ) : null}
      <section className="rounded-lg border border-line bg-card p-4">
        <h2 className="font-medium">Hand-entered item</h2>
        <form action={handEntryAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            SKU
            <input className={inputClass} name="sku" required />
          </label>
          <label className={labelClass}>
            Description
            <input className={inputClass} name="itemDescription" required />
          </label>
          <label className={labelClass}>
            Manufacturer part
            <input className={inputClass} name="partNumber" />
          </label>
          <label className={labelClass}>
            Manufacturer
            <input className={inputClass} name="maker" />
          </label>
          <label className={labelClass}>
            Cost
            <input className={inputClass} name="cost" placeholder="620.00" />
          </label>
          <label className={labelClass}>
            MSRP
            <input className={inputClass} name="msrp" />
          </label>
          <label className={labelClass}>
            Stock
            <input className={inputClass} name="stock" />
          </label>
          <div className="flex items-end">
            <button className={buttonClass} type="submit">
              Save item
            </button>
          </div>
        </form>
      </section>
      <section className="rounded-lg border border-line bg-card p-4">
        <h2 className="font-medium">CSV import</h2>
        <p className="mt-1 text-sm text-muted">
          Map each field to the header name in the file. Costs are dollars.
        </p>
        <form action={importCsvAction} className="mt-3 grid gap-3">
          <label className={labelClass}>
            CSV
            <textarea className={`${inputClass} min-h-32 font-mono text-xs`} name="csv" defaultValue={sampleCsv} />
          </label>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className={labelClass}>
              SKU column
              <input className={inputClass} name="sku" defaultValue="sku" />
            </label>
            <label className={labelClass}>
              Description column
              <input className={inputClass} name="description" defaultValue="description" />
            </label>
            <label className={labelClass}>
              Part column
              <input className={inputClass} name="mpn" defaultValue="mpn" />
            </label>
            <label className={labelClass}>
              Manufacturer column
              <input className={inputClass} name="manufacturer" defaultValue="manufacturer" />
            </label>
            <label className={labelClass}>
              Cost column
              <input className={inputClass} name="cost" defaultValue="cost" />
            </label>
            <label className={labelClass}>
              MSRP column
              <input className={inputClass} name="msrp" defaultValue="msrp" />
            </label>
            <label className={labelClass}>
              Stock column
              <input className={inputClass} name="stock" defaultValue="stock" />
            </label>
          </div>
          <button className={secondaryButtonClass} type="submit">
            Import
          </button>
        </form>
      </section>
    </div>
  );
}
