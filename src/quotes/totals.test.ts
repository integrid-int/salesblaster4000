import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extendedCents, suggestUnitPrice } from "../core/money";
import { quoteTotals, type Billing, type TotalLine } from "./totals";

interface FixtureLine {
  name: string;
  costCents: number;
  qtyMilli: number;
  billing: Billing;
  optional: boolean;
  selected: boolean;
  taxable: boolean;
  unitPriceCents: number;
  extendedCents: number;
}

interface Fixture {
  pricing: { markupBps: number; minMarginBps: number };
  taxBps: number;
  lines: FixtureLine[];
  expected: Record<Billing, { priceCents: number; costCents: number; marginBps: number | null; taxCents: number }>;
}

const fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "fixtures/quotes/hand-checked-totals.json"), "utf8"),
) as Fixture;

describe("hand-checked quote totals", () => {
  it("matches the fixture for markup, line totals, and group margin", () => {
    const lines: TotalLine[] = fixture.lines.map((line) => {
      const unitPrice = suggestUnitPrice(
        line.costCents,
        fixture.pricing.markupBps,
        fixture.pricing.minMarginBps,
      );
      expect(unitPrice, line.name).toBe(line.unitPriceCents);
      expect(extendedCents(line.unitPriceCents, line.qtyMilli), line.name).toBe(line.extendedCents);
      return {
        qtyMilli: line.qtyMilli,
        unitCostCents: line.costCents,
        unitPriceCents: line.unitPriceCents,
        billing: line.billing,
        optional: line.optional,
        selected: line.selected,
        taxable: line.taxable,
      };
    });

    const totals = quoteTotals(lines, fixture.taxBps);
    expect(totals.excludedOptionalCount).toBe(1);
    for (const billing of ["once", "monthly", "annual"] as const) {
      expect(totals.groups[billing].priceCents, billing).toBe(fixture.expected[billing].priceCents);
      expect(totals.groups[billing].costCents, billing).toBe(fixture.expected[billing].costCents);
      expect(totals.groups[billing].marginBps, billing).toBe(fixture.expected[billing].marginBps);
      expect(totals.groups[billing].taxCents, billing).toBe(fixture.expected[billing].taxCents);
    }
  });

  it("taxes the included taxable subtotal once", () => {
    const totals = quoteTotals(
      [
        {
          qtyMilli: 1_000,
          unitCostCents: 10_000,
          unitPriceCents: 48_000,
          billing: "once",
          optional: false,
          selected: true,
          taxable: true,
        },
      ],
      800,
    );
    expect(totals.groups.once.taxCents).toBe(3_840);
  });

  it("hides margin when an included line has no cost snapshot", () => {
    const totals = quoteTotals(
      [
        {
          qtyMilli: 1_000,
          unitCostCents: null,
          unitPriceCents: 5_000,
          billing: "annual",
          optional: false,
          selected: true,
          taxable: false,
        },
      ],
      0,
    );
    expect(totals.groups.annual.costComplete).toBe(false);
    expect(totals.groups.annual.marginBps).toBeNull();
    expect(totals.groups.annual.priceCents).toBe(5_000);
  });
});
