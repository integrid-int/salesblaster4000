import { extendedCents, marginBps, mulDivRound } from "../core/money";

export type Billing = "once" | "monthly" | "annual";

export interface TotalLine {
  qtyMilli: number;
  unitCostCents: number | null;
  unitPriceCents: number;
  billing: Billing;
  optional: boolean;
  selected: boolean;
  taxable: boolean;
}

export interface TotalGroup {
  costCents: number;
  priceCents: number;
  taxCents: number;
  marginBps: number | null;
  costComplete: boolean;
  lineCount: number;
}

export interface QuoteTotals {
  groups: Record<Billing, TotalGroup>;
  excludedOptionalCount: number;
}

function emptyGroup(): TotalGroup {
  return {
    costCents: 0,
    priceCents: 0,
    taxCents: 0,
    marginBps: null,
    costComplete: true,
    lineCount: 0,
  };
}

export function lineIncluded(line: Pick<TotalLine, "optional" | "selected">): boolean {
  return !line.optional || line.selected;
}

export function quoteTotals(lines: TotalLine[], taxBps: number): QuoteTotals {
  if (taxBps < 0) throw new Error("tax cannot be negative");
  const groups: Record<Billing, TotalGroup & { taxablePriceCents: number }> = {
    once: { ...emptyGroup(), taxablePriceCents: 0 },
    monthly: { ...emptyGroup(), taxablePriceCents: 0 },
    annual: { ...emptyGroup(), taxablePriceCents: 0 },
  };
  let excludedOptionalCount = 0;

  for (const line of lines) {
    if (!lineIncluded(line)) {
      excludedOptionalCount += 1;
      continue;
    }
    const group = groups[line.billing];
    const price = extendedCents(line.unitPriceCents, line.qtyMilli);
    group.priceCents += price;
    group.lineCount += 1;
    if (line.taxable) group.taxablePriceCents += price;
    if (line.unitCostCents === null) {
      group.costComplete = false;
    } else {
      group.costCents += extendedCents(line.unitCostCents, line.qtyMilli);
    }
  }

  const result = {} as Record<Billing, TotalGroup>;
  for (const billing of ["once", "monthly", "annual"] as const) {
    const group = groups[billing];
    result[billing] = {
      costCents: group.costCents,
      priceCents: group.priceCents,
      taxCents: mulDivRound(group.taxablePriceCents, taxBps, 10_000),
      marginBps: group.costComplete ? marginBps(group.costCents, group.priceCents) : null,
      costComplete: group.costComplete,
      lineCount: group.lineCount,
    };
  }

  return { groups: result, excludedOptionalCount };
}
