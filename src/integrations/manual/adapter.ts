import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { normalizeMpn } from "../../core/mpn";
import type { CatalogAdapter, CatalogItem, PriceStock } from "../../core/types";
import { catalogItems } from "../../db/schema";
import type { AppDatabase } from "../../db/types";
import { importCsv, type ColumnMapping, type CsvImportResult } from "./csv";

export interface HandEnteredInput {
  sku: string;
  description: string;
  mfrPartNumber?: string | null;
  manufacturer?: string | null;
  costCents?: number | null;
  msrpCents?: number | null;
  stock?: number | null;
  fetchedAt: string;
}

export function handEnteredItem(input: HandEnteredInput): CatalogItem {
  const sku = input.sku.trim();
  const description = input.description.trim();
  if (!sku) throw new Error("SKU is required.");
  if (!description) throw new Error("Description is required.");
  if (input.costCents != null && input.costCents < 0) throw new Error("Cost cannot be negative.");
  return {
    source: "manual",
    sourceSku: sku,
    mfrPartNumber: input.mfrPartNumber?.trim() || null,
    manufacturer: input.manufacturer?.trim() || null,
    description,
    costCents: input.costCents ?? null,
    msrpCents: input.msrpCents ?? null,
    stock: input.stock ?? null,
    fetchedAt: input.fetchedAt,
  };
}

export async function saveManualItems(db: AppDatabase, items: CatalogItem[]): Promise<void> {
  for (const item of items) {
    if (item.source !== "manual") throw new Error("The manual adapter only stores manual items.");
    const values = {
      source: "manual" as const,
      sourceSku: item.sourceSku,
      mfrPartNumber: item.mfrPartNumber,
      normalizedMpn: normalizeMpn(item.mfrPartNumber),
      manufacturer: item.manufacturer,
      description: item.description,
      costCents: item.costCents,
      msrpCents: item.msrpCents,
      stock: item.stock,
      fetchedAt: new Date(item.fetchedAt),
      haloItemId: item.haloItemId ?? null,
      updatedAt: new Date(),
    };
    await db
      .insert(catalogItems)
      .values(values)
      .onConflictDoUpdate({
        target: [catalogItems.source, catalogItems.sourceSku],
        set: values,
      });
  }
}

export async function importAndSaveCsv(
  db: AppDatabase,
  text: string,
  mapping: ColumnMapping,
  fetchedAt = new Date().toISOString(),
): Promise<CsvImportResult> {
  const result = importCsv(text, mapping, fetchedAt);
  await saveManualItems(db, result.items);
  return result;
}

function toCatalogItem(row: typeof catalogItems.$inferSelect): CatalogItem {
  return {
    source: row.source,
    sourceSku: row.sourceSku,
    mfrPartNumber: row.mfrPartNumber,
    manufacturer: row.manufacturer,
    description: row.description,
    costCents: row.costCents,
    msrpCents: row.msrpCents,
    stock: row.stock,
    fetchedAt: row.fetchedAt.toISOString(),
    ...(row.haloItemId == null ? {} : { haloItemId: row.haloItemId }),
  };
}

export function createManualAdapter(db: AppDatabase): CatalogAdapter {
  return {
    id: "manual",
    async search(query, opts) {
      const term = query.trim().replace(/[%_]/g, "");
      if (!term) return [];
      const pattern = `%${term}%`;
      const rows = await db
        .select()
        .from(catalogItems)
        .where(
          and(
            eq(catalogItems.source, "manual"),
            or(
              ilike(catalogItems.description, pattern),
              ilike(catalogItems.sourceSku, pattern),
              ilike(catalogItems.mfrPartNumber, pattern),
              ilike(catalogItems.manufacturer, pattern),
            ),
          ),
        )
        .limit(opts?.limit ?? 25);
      return rows.map(toCatalogItem);
    },
    async priceAndAvailability(skus) {
      if (skus.length === 0) return [];
      const rows = await db
        .select()
        .from(catalogItems)
        .where(and(eq(catalogItems.source, "manual"), inArray(catalogItems.sourceSku, skus)));
      return rows.map(
        (row): PriceStock => ({
          sourceSku: row.sourceSku,
          costCents: row.costCents,
          stock: row.stock,
          fetchedAt: row.fetchedAt.toISOString(),
        }),
      );
    },
    async healthCheck() {
      return { ok: true, detail: "manual catalog is local", checkedAt: new Date().toISOString() };
    },
  };
}
