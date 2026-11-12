import { and, eq } from "drizzle-orm";
import { catalogItems, clients, contacts, pricingRules } from "./schema";
import type { AppDatabase } from "./types";
import { normalizeMpn } from "../core/mpn";

const syncedAt = new Date("2026-11-12T00:00:00.000Z");

/**
 * Local stand-ins for Halo cache rows. This runs only when the development
 * bypass is on and no Postgres URL is set. It never creates a client master.
 */
export async function seedSampleData(db: AppDatabase): Promise<void> {
  const existingClients = await db.select({ id: clients.id }).from(clients).limit(1);
  if (existingClients.length === 0) {
    const [northwind] = await db
      .insert(clients)
      .values({
        haloClientId: 900001,
        name: "Northwind Clinic (sample)",
        taxCode: "EXEMPT",
        syncedAt,
      })
      .returning();
    const [harbor] = await db
      .insert(clients)
      .values({
        haloClientId: 900002,
        name: "Harbor School District (sample)",
        taxCode: "TAXABLE",
        syncedAt,
      })
      .returning();
    await db.insert(contacts).values([
      {
        haloUserId: 910001,
        clientId: northwind!.id,
        name: "Avery Chen (sample)",
        email: "avery.chen@example.test",
        syncedAt,
      },
      {
        haloUserId: 910002,
        clientId: harbor!.id,
        name: "Jordan Hale (sample)",
        email: "jordan.hale@example.test",
        syncedAt,
      },
    ]);
  }

  const [rule] = await db
    .select({ id: pricingRules.id })
    .from(pricingRules)
    .where(eq(pricingRules.scope, "default"))
    .limit(1);
  if (!rule) {
    await db.insert(pricingRules).values({
      scope: "default",
      markupBps: 2_000,
      minMarginBps: 1_000,
    });
  }

  const samples = [
    {
      sourceSku: "FG-60F",
      mfrPartNumber: "FG-60F",
      manufacturer: "Fortinet",
      description: "FortiGate 60F firewall",
      costCents: 62_000,
      msrpCents: 89_500,
      stock: 4,
    },
    {
      sourceSku: "BCK-M",
      mfrPartNumber: "BCK-M",
      manufacturer: "Acme",
      description: "Workstation backup, monthly",
      costCents: 1_500,
      msrpCents: 2_500,
      stock: null,
    },
  ];
  for (const sample of samples) {
    const [existing] = await db
      .select({ id: catalogItems.id })
      .from(catalogItems)
      .where(and(eq(catalogItems.source, "manual"), eq(catalogItems.sourceSku, sample.sourceSku)))
      .limit(1);
    if (existing) continue;
    await db.insert(catalogItems).values({
      source: "manual",
      sourceSku: sample.sourceSku,
      mfrPartNumber: sample.mfrPartNumber,
      normalizedMpn: normalizeMpn(sample.mfrPartNumber),
      manufacturer: sample.manufacturer,
      description: sample.description,
      costCents: sample.costCents,
      msrpCents: sample.msrpCents,
      stock: sample.stock,
      fetchedAt: syncedAt,
    });
  }
}
