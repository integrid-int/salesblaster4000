import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  acceptances,
  catalogItems,
  clients,
  contacts,
  opportunities,
  outbox,
  payments,
  pricingRules,
  quoteLines,
  quoteSections,
  quotes,
  sites,
  templates,
  users,
} from "./schema";
import { createTestDb } from "./test-db";

const tableNames = [
  "users",
  "clients",
  "sites",
  "contacts",
  "opportunities",
  "catalog_items",
  "quotes",
  "quote_sections",
  "quote_lines",
  "templates",
  "pricing_rules",
  "acceptances",
  "payments",
  "outbox",
];

describe("schema", () => {
  it("migrates all 14 tables and can store one quote graph", async () => {
    const db = await createTestDb();
    await createTestDb();
    const tables = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    const names = tables.rows.map((row) => row.table_name);
    for (const name of tableNames) {
      expect(names).toContain(name);
    }

    const now = new Date("2026-11-12T00:00:00.000Z");
    const [user] = await db
      .insert(users)
      .values({ entraOid: "oid-1", email: "ryan@integrid.net", role: "admin" })
      .returning();
    const [client] = await db
      .insert(clients)
      .values({ haloClientId: 42, name: "Northwind", taxCode: "TAX", syncedAt: now })
      .returning();
    await db.insert(sites).values({ haloSiteId: 7, clientId: client!.id, syncedAt: now });
    const [contact] = await db
      .insert(contacts)
      .values({ haloUserId: 9, clientId: client!.id, name: "Ada", email: "ada@example.test", syncedAt: now })
      .returning();
    const [opportunity] = await db
      .insert(opportunities)
      .values({
        haloTicketId: 11,
        clientId: client!.id,
        title: "Firewall refresh",
        status: "open",
        syncedAt: now,
      })
      .returning();
    const [item] = await db
      .insert(catalogItems)
      .values({
        source: "manual",
        sourceSku: "FG-60F",
        description: "FortiGate 60F",
        costCents: 62_000,
        fetchedAt: now,
      })
      .returning();
    const [quote] = await db
      .insert(quotes)
      .values({
        number: "Q-0001",
        clientId: client!.id,
        contactId: contact!.id,
        opportunityId: opportunity!.id,
        publicToken: "token-1",
        createdById: user!.id,
      })
      .returning();
    const [section] = await db
      .insert(quoteSections)
      .values({ quoteId: quote!.id, title: "Equipment", position: 0 })
      .returning();
    await db.insert(quoteLines).values({
      sectionId: section!.id,
      catalogItemId: item!.id,
      description: "FortiGate 60F",
      qtyMilli: 1_000,
      unitCostCents: 62_000,
      unitPriceCents: 74_400,
      billing: "once",
      position: 0,
    });
    await db.insert(templates).values({ kind: "terms", name: "default", body: "Terms" });
    await db.insert(pricingRules).values({ scope: "default", markupBps: 2_000, minMarginBps: 1_000 });
    await db.insert(acceptances).values({
      quoteId: quote!.id,
      version: 1,
      signerName: "Ada",
      signerEmail: "ada@example.test",
      pdfSha256: "abc",
      acceptedAt: now,
    });
    await db.insert(payments).values({
      quoteId: quote!.id,
      benjiTransactionId: "benji-1",
      amountCents: 37_200,
      status: "recorded",
    });
    await db.insert(outbox).values({
      target: "halo",
      operation: "createQuotation",
      payload: { quoteId: quote!.id },
      idempotencyKey: "halo:createQuotation:Q-0001:1",
    });

    await expect(
      db.insert(clients).values({ haloClientId: 42, name: "Duplicate", syncedAt: now }),
    ).rejects.toThrow();
    await expect(
      db.insert(outbox).values({
        target: "halo",
        operation: "createQuotation",
        payload: {},
        idempotencyKey: "halo:createQuotation:Q-0001:1",
      }),
    ).rejects.toThrow();
  });
});
