import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Role } from "../auth/policy";
import { formatUsd, parseDollarsToCents, parseQtyMilli, priceForMinMargin, suggestUnitPrice } from "../core/money";
import { handEnteredItem, saveManualItems } from "../integrations/manual/adapter";
import { catalogItems, pricingRules, quoteLines, quoteSections, quotes } from "../db/schema";
import type { AppDatabase } from "../db/types";
import type { Billing } from "./totals";

export class QuoteError extends Error {}

async function connectionOf(tx: unknown): Promise<AppDatabase> {
  return tx as AppDatabase;
}

async function nextQuoteNumber(db: AppDatabase): Promise<string> {
  const rows = await db.select({ number: quotes.number }).from(quotes);
  let max = 0;
  for (const row of rows) {
    const match = /^Q-(\d+)$/.exec(row.number);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `Q-${String(max + 1).padStart(4, "0")}`;
}

async function pricingFor(db: AppDatabase): Promise<{ markupBps: number; minMarginBps: number }> {
  const [rule] = await db
    .select()
    .from(pricingRules)
    .where(eq(pricingRules.scope, "default"))
    .limit(1);
  return { markupBps: rule?.markupBps ?? 0, minMarginBps: rule?.minMarginBps ?? 0 };
}

async function requireDraft(db: AppDatabase, quoteId: string) {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  if (!quote) throw new QuoteError("Quote not found.");
  if (quote.status !== "draft") throw new QuoteError("Only a draft quote can be edited.");
  return quote;
}

export async function createDraftQuote(
  db: AppDatabase,
  input: { clientId: string; createdById: string; depositBps?: number },
) {
  if (input.depositBps != null && (input.depositBps < 0 || input.depositBps > 10_000)) {
    throw new QuoteError("Deposit must be between 0% and 100%.");
  }
  return db.transaction(async (tx) => {
    const connection = await connectionOf(tx);
    await connection.execute(sql`select pg_advisory_xact_lock(8723641)`);
    const [created] = await connection
      .insert(quotes)
      .values({
        number: await nextQuoteNumber(connection),
        clientId: input.clientId,
        createdById: input.createdById,
        depositBps: input.depositBps ?? 0,
        publicToken: randomBytes(32).toString("base64url"),
      })
      .returning();
    return created!;
  });
}

export async function addSection(db: AppDatabase, input: { quoteId: string; title: string }) {
  const title = input.title.trim();
  if (!title) throw new QuoteError("A section needs a title.");
  return db.transaction(async (tx) => {
    const connection = await connectionOf(tx);
    await requireDraft(connection, input.quoteId);
    const existing = await connection
      .select({ id: quoteSections.id })
      .from(quoteSections)
      .where(eq(quoteSections.quoteId, input.quoteId));
    const [section] = await connection
      .insert(quoteSections)
      .values({ quoteId: input.quoteId, title, position: existing.length })
      .returning();
    return section!;
  });
}

export async function addCatalogLine(
  db: AppDatabase,
  input: {
    sectionId: string;
    catalogItemId: string;
    qtyMilli: number;
    billing: Billing;
    optional: boolean;
  },
) {
  if (input.qtyMilli <= 0) throw new QuoteError("Quantity must be greater than zero.");
  return db.transaction(async (tx) => {
    const connection = await connectionOf(tx);
    const [section] = await connection
      .select()
      .from(quoteSections)
      .where(eq(quoteSections.id, input.sectionId))
      .limit(1);
    if (!section) throw new QuoteError("Section not found.");
    await requireDraft(connection, section.quoteId);
    const [item] = await connection
      .select()
      .from(catalogItems)
      .where(eq(catalogItems.id, input.catalogItemId))
      .limit(1);
    if (!item) throw new QuoteError("Catalog item not found.");
    const rule = await pricingFor(connection);
    const unitPriceCents = suggestUnitPrice(item.costCents, rule.markupBps, rule.minMarginBps);
    if (unitPriceCents === null) {
      throw new QuoteError("This item has no cost. Enter a price on a hand-entered line.");
    }
    const existing = await connection
      .select({ id: quoteLines.id })
      .from(quoteLines)
      .where(eq(quoteLines.sectionId, section.id));
    const [line] = await connection
      .insert(quoteLines)
      .values({
        sectionId: section.id,
        catalogItemId: item.id,
        description: item.description,
        qtyMilli: input.qtyMilli,
        unitCostCents: item.costCents,
        unitPriceCents,
        billing: input.billing,
        optional: input.optional,
        selected: true,
        position: existing.length,
      })
      .returning();
    return line!;
  });
}

export async function addHandEnteredLine(
  db: AppDatabase,
  input: {
    sectionId: string;
    sku: string;
    description: string;
    mfrPartNumber?: string | null;
    manufacturer?: string | null;
    costCents: number | null;
    priceCents: number;
    qtyMilli: number;
    billing: Billing;
    optional: boolean;
    role: Role;
  },
) {
  if (input.priceCents < 0) throw new QuoteError("Price cannot be negative.");
  if (input.qtyMilli <= 0) throw new QuoteError("Quantity must be greater than zero.");
  const item = handEnteredItem({
    sku: input.sku,
    description: input.description,
    mfrPartNumber: input.mfrPartNumber,
    manufacturer: input.manufacturer,
    costCents: input.costCents,
    fetchedAt: new Date().toISOString(),
  });
  await saveManualItems(db, [item]);
  const [saved] = await db
    .select()
    .from(catalogItems)
    .where(and(eq(catalogItems.source, "manual"), eq(catalogItems.sourceSku, item.sourceSku)))
    .limit(1);
  if (!saved) throw new QuoteError("The hand-entered item was not saved.");
  const rule = await pricingFor(db);
  assertPriceAllowed(input.role, saved.costCents, input.priceCents, rule.minMarginBps);
  return db.transaction(async (tx) => {
    const connection = await connectionOf(tx);
    const [section] = await connection
      .select()
      .from(quoteSections)
      .where(eq(quoteSections.id, input.sectionId))
      .limit(1);
    if (!section) throw new QuoteError("Section not found.");
    await requireDraft(connection, section.quoteId);
    const existing = await connection
      .select({ id: quoteLines.id })
      .from(quoteLines)
      .where(eq(quoteLines.sectionId, section.id));
    const [line] = await connection
      .insert(quoteLines)
      .values({
        sectionId: section.id,
        catalogItemId: saved.id,
        description: item.description,
        qtyMilli: input.qtyMilli,
        unitCostCents: saved.costCents,
        unitPriceCents: input.priceCents,
        billing: input.billing,
        optional: input.optional,
        selected: true,
        position: existing.length,
      })
      .returning();
    return line!;
  });
}

function assertPriceAllowed(
  role: Role,
  costCents: number | null,
  priceCents: number,
  minMarginBps: number,
) {
  if (role === "admin" || costCents === null) return;
  const floor = priceForMinMargin(costCents, minMarginBps);
  if (priceCents < floor) {
    throw new QuoteError(`Price must be at least ${formatUsd(floor)} to meet the minimum margin.`);
  }
}

export async function updateLine(
  db: AppDatabase,
  input: {
    lineId: string;
    role: Role;
    qty?: string;
    price?: string;
    billing?: Billing;
    optional?: boolean;
    selected?: boolean;
  },
) {
  let qtyMilli: number | undefined;
  if (input.qty !== undefined) {
    const parsedQty = parseQtyMilli(input.qty);
    if (parsedQty === null) throw new QuoteError("Quantity must be a positive number.");
    qtyMilli = parsedQty;
  }
  let parsedPrice: number | undefined;
  if (input.price !== undefined && input.price.trim() !== "") {
    const parsed = parseDollarsToCents(input.price);
    if (parsed === null || parsed < 0) throw new QuoteError("Price must be a dollar amount.");
    parsedPrice = parsed;
  }
  return db.transaction(async (tx) => {
    const connection = await connectionOf(tx);
    const [line] = await connection.select().from(quoteLines).where(eq(quoteLines.id, input.lineId)).limit(1);
    if (!line) throw new QuoteError("Line not found.");
    const [section] = await connection
      .select()
      .from(quoteSections)
      .where(eq(quoteSections.id, line.sectionId))
      .limit(1);
    if (!section) throw new QuoteError("Section not found.");
    await requireDraft(connection, section.quoteId);
    if (parsedPrice !== undefined) {
      const rule = await pricingFor(connection);
      assertPriceAllowed(input.role, line.unitCostCents, parsedPrice, rule.minMarginBps);
    }
    const [updated] = await connection
      .update(quoteLines)
      .set({
        ...(qtyMilli !== undefined ? { qtyMilli } : {}),
        ...(parsedPrice !== undefined ? { unitPriceCents: parsedPrice } : {}),
        ...(input.billing !== undefined ? { billing: input.billing } : {}),
        ...(input.optional !== undefined ? { optional: input.optional } : {}),
        ...(input.selected !== undefined ? { selected: input.selected } : {}),
      })
      .where(eq(quoteLines.id, line.id))
      .returning();
    return updated!;
  });
}

export async function removeLine(db: AppDatabase, lineId: string) {
  return db.transaction(async (tx) => {
    const connection = await connectionOf(tx);
    const [line] = await connection.select().from(quoteLines).where(eq(quoteLines.id, lineId)).limit(1);
    if (!line) throw new QuoteError("Line not found.");
    const [section] = await connection
      .select()
      .from(quoteSections)
      .where(eq(quoteSections.id, line.sectionId))
      .limit(1);
    if (!section) throw new QuoteError("Section not found.");
    await requireDraft(connection, section.quoteId);
    await connection.delete(quoteLines).where(eq(quoteLines.id, line.id));
  });
}

export async function saveDefaultPricingRule(
  db: AppDatabase,
  input: { markupBps: number; minMarginBps: number; role: Role },
) {
  if (input.role !== "admin") throw new QuoteError("Only an admin can change pricing rules.");
  if (input.markupBps < 0 || input.markupBps > 100_000) {
    throw new QuoteError("Markup must be between 0% and 1000%.");
  }
  if (input.minMarginBps < 0 || input.minMarginBps >= 10_000) {
    throw new QuoteError("Minimum margin must be under 100%.");
  }
  await db
    .insert(pricingRules)
    .values({ scope: "default", markupBps: input.markupBps, minMarginBps: input.minMarginBps })
    .onConflictDoUpdate({
      target: pricingRules.scope,
      set: {
        markupBps: input.markupBps,
        minMarginBps: input.minMarginBps,
        updatedAt: new Date(),
      },
    });
}
