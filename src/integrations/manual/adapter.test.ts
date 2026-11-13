import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { catalogItems } from "../../db/schema";
import { createTestDb } from "../../db/test-db";
import { createManualAdapter, handEnteredItem, importAndSaveCsv, saveManualItems } from "./adapter";

describe("manual adapter", () => {
  it("stores a hand-entered line and finds it by part number", async () => {
    const db = await createTestDb();
    const item = handEnteredItem({
      sku: "FG-60F",
      description: "FortiGate 60F firewall",
      mfrPartNumber: "FG-60F",
      manufacturer: "Fortinet",
      costCents: 62_000,
      fetchedAt: "2026-11-12T00:00:00.000Z",
    });
    await saveManualItems(db, [item]);
    const adapter = createManualAdapter(db);
    const found = await adapter.search("fg-60f");
    expect(found).toHaveLength(1);
    expect(found[0]?.costCents).toBe(62_000);
    const priced = await adapter.priceAndAvailability(["FG-60F"]);
    expect(priced[0]?.stock).toBeNull();
    expect((await adapter.healthCheck()).ok).toBe(true);
  });

  it("updates the catalog row in place when the same SKU is imported again", async () => {
    const db = await createTestDb();
    const mapping = { sku: "sku", description: "description", cost: "cost", mfrPartNumber: "mpn" };
    await importAndSaveCsv(db, "sku,description,mpn,cost\nABC,First,ab-c,10.00\n", mapping);
    await importAndSaveCsv(db, "sku,description,mpn,cost\nABC,Second,AB C,12.50\n", mapping);
    const rows = await db.select().from(catalogItems).where(eq(catalogItems.sourceSku, "ABC"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.description).toBe("Second");
    expect(rows[0]?.costCents).toBe(1_250);
    expect(rows[0]?.normalizedMpn).toBe("ABC");
  });
});
