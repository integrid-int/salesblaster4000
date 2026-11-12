import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { catalogItems, clients, pricingRules, quoteLines, users } from "../db/schema";
import { createTestDb } from "../db/test-db";
import { formatUsd } from "../core/money";
import { quoteTotals } from "./totals";
import {
  QuoteError,
  addCatalogLine,
  addSection,
  createDraftQuote,
  saveDefaultPricingRule,
  updateLine,
} from "./commands";

async function fixture() {
  const db = await createTestDb();
  const now = new Date("2026-11-12T00:00:00.000Z");
  const [seller] = await db
    .insert(users)
    .values({ entraOid: "seller", email: "seller@integrid.net", role: "seller" })
    .returning();
  const [admin] = await db
    .insert(users)
    .values({ entraOid: "admin", email: "ryan@integrid.net", role: "admin" })
    .returning();
  const [client] = await db
    .insert(clients)
    .values({ haloClientId: 900001, name: "Northwind Clinic (sample)", syncedAt: now })
    .returning();
  await db.insert(pricingRules).values({ scope: "default", markupBps: 2_000, minMarginBps: 1_000 });
  const [item] = await db
    .insert(catalogItems)
    .values({
      source: "manual",
      sourceSku: "FG-60F",
      description: "FortiGate 60F firewall",
      costCents: 10_000,
      fetchedAt: now,
    })
    .returning();
  const quote = await createDraftQuote(db, { clientId: client!.id, createdById: seller!.id });
  const section = await addSection(db, { quoteId: quote.id, title: "Equipment" });
  return { db, seller: seller!, admin: admin!, item: item!, quote, section };
}

describe("quote commands", () => {
  it("snapshots cost and prices a line from the default markup rule", async () => {
    const { db, item, section } = await fixture();
    const line = await addCatalogLine(db, {
      sectionId: section.id,
      catalogItemId: item.id,
      qtyMilli: 2_000,
      billing: "once",
      optional: false,
    });
    expect(line.unitCostCents).toBe(10_000);
    expect(line.unitPriceCents).toBe(12_000);
    await db.update(catalogItems).set({ costCents: 1 }).where(eq(catalogItems.id, item.id));
    const [stored] = await db.select().from(quoteLines).where(eq(quoteLines.id, line.id));
    expect(stored?.unitCostCents).toBe(10_000);
    const totals = quoteTotals(
      [
        {
          qtyMilli: stored!.qtyMilli,
          unitCostCents: stored!.unitCostCents,
          unitPriceCents: stored!.unitPriceCents,
          billing: stored!.billing,
          optional: stored!.optional,
          selected: stored!.selected,
          taxable: stored!.taxable,
        },
      ],
      0,
    );
    expect(totals.groups.once.priceCents).toBe(24_000);
    expect(formatUsd(totals.groups.once.priceCents)).toBe("$240.00");
  });

  it("blocks a seller from pricing under the minimum margin and lets an admin through", async () => {
    const { db, item, section, admin } = await fixture();
    const line = await addCatalogLine(db, {
      sectionId: section.id,
      catalogItemId: item.id,
      qtyMilli: 1_000,
      billing: "once",
      optional: false,
    });
    await expect(updateLine(db, { lineId: line.id, role: "seller", price: "105.00" })).rejects.toBeInstanceOf(
      QuoteError,
    );
    const updated = await updateLine(db, { lineId: line.id, role: "admin", price: "105.00" });
    expect(updated.unitPriceCents).toBe(10_500);
    expect(admin.role).toBe("admin");
  });

  it("refuses a second quote number collision and a seller pricing-rule edit", async () => {
    const { db, seller } = await fixture();
    const second = await createDraftQuote(db, { clientId: (await db.select().from(clients))[0]!.id, createdById: seller.id });
    expect(second.number).toBe("Q-0002");
    await expect(
      saveDefaultPricingRule(db, { markupBps: 5_000, minMarginBps: 2_000, role: "seller" }),
    ).rejects.toBeInstanceOf(QuoteError);
  });
});
