import { normalizeMpn } from "../core/mpn";
import type { CatalogAdapter, CatalogItem, SearchOpts } from "../core/types";

export interface CatalogFailure {
  source: string;
  message: string;
}

export interface MergedProduct {
  key: string;
  mfrPartNumber: string | null;
  manufacturer: string | null;
  description: string;
  offers: CatalogItem[];
}

export interface CatalogSearchResult {
  products: MergedProduct[];
  failures: CatalogFailure[];
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, source: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${source} timed out`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function mergeOffers(items: CatalogItem[]): MergedProduct[] {
  const groups = new Map<string, MergedProduct>();
  for (const item of items) {
    const normalized = normalizeMpn(item.mfrPartNumber);
    const key = normalized ?? `solo:${item.source}:${item.sourceSku}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        mfrPartNumber: item.mfrPartNumber,
        manufacturer: item.manufacturer,
        description: item.description,
        offers: [item],
      });
      continue;
    }
    existing.offers.push(item);
    if (item.description.length > existing.description.length) {
      existing.description = item.description;
    }
    if (!existing.manufacturer && item.manufacturer) existing.manufacturer = item.manufacturer;
  }
  for (const product of groups.values()) {
    product.offers.sort((left, right) => {
      if (left.costCents === null) return 1;
      if (right.costCents === null) return -1;
      return left.costCents - right.costCents;
    });
  }
  return [...groups.values()];
}

export async function searchCatalog(
  adapters: CatalogAdapter[],
  query: string,
  opts: SearchOpts = {},
): Promise<CatalogSearchResult> {
  const timeoutMs = opts.timeoutMs ?? 8_000;
  const settled = await Promise.all(
    adapters.map(async (adapter) => {
      try {
        const items = await withTimeout(adapter.search(query, opts), timeoutMs, adapter.id);
        return { ok: true as const, source: adapter.id, items };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Source failed";
        return { ok: false as const, source: adapter.id, message };
      }
    }),
  );
  const items: CatalogItem[] = [];
  const failures: CatalogFailure[] = [];
  for (const result of settled) {
    if (result.ok) items.push(...result.items);
    else failures.push({ source: result.source, message: result.message });
  }
  return { products: mergeOffers(items), failures };
}
