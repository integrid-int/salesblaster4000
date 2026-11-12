import { asc, eq } from "drizzle-orm";
import { clients, pricingRules } from "../db/schema";
import type { AppDatabase } from "../db/types";
import { quoteTotals, type TotalLine } from "./totals";

export async function listClients(db: AppDatabase) {
  return db.select().from(clients).orderBy(asc(clients.name));
}

export async function getDefaultPricingRule(db: AppDatabase) {
  const [rule] = await db
    .select()
    .from(pricingRules)
    .where(eq(pricingRules.scope, "default"))
    .limit(1);
  return rule ?? null;
}

export async function listQuotes(db: AppDatabase) {
  const rows = await db.query.quotes.findMany({
    with: { client: true, sections: { with: { lines: true } } },
    orderBy: (table, operators) => [operators.desc(table.createdAt)],
  });
  return rows.map((quote) => ({
    ...quote,
    totals: quoteTotals(quote.sections.flatMap((section) => section.lines.map(toTotalLine)), quote.taxBps),
  }));
}

export async function getQuote(db: AppDatabase, id: string) {
  const quote = await db.query.quotes.findFirst({
    where: (table, operators) => operators.eq(table.id, id),
    with: {
      client: true,
      sections: { with: { lines: true } },
    },
  });
  if (!quote) return null;
  const sections = [...quote.sections]
    .sort((left, right) => left.position - right.position)
    .map((section) => ({
      ...section,
      lines: [...section.lines].sort((left, right) => left.position - right.position),
    }));
  return {
    ...quote,
    sections,
    totals: quoteTotals(sections.flatMap((section) => section.lines.map(toTotalLine)), quote.taxBps),
  };
}

function toTotalLine(line: {
  qtyMilli: number;
  unitCostCents: number | null;
  unitPriceCents: number;
  billing: TotalLine["billing"];
  optional: boolean;
  selected: boolean;
  taxable: boolean;
}): TotalLine {
  return {
    qtyMilli: line.qtyMilli,
    unitCostCents: line.unitCostCents,
    unitPriceCents: line.unitPriceCents,
    billing: line.billing,
    optional: line.optional,
    selected: line.selected,
    taxable: line.taxable,
  };
}
