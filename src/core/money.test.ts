import { describe, expect, it } from "vitest";
import {
  applyMarkup,
  enforceMinMargin,
  extendedCents,
  formatPercentFromBps,
  formatQty,
  formatUsd,
  marginBps,
  parseDollarsToCents,
  parseQtyMilli,
  percentToBps,
  priceForMinMargin,
  suggestUnitPrice,
} from "./money";

describe("money", () => {
  it("applies markup in basis points with half-up rounding", () => {
    expect(applyMarkup(10_000, 2_000)).toBe(12_000);
    expect(applyMarkup(10_000, 500)).toBe(10_500);
    expect(applyMarkup(1, 500)).toBe(1);
  });

  it("raises the price until the minimum margin holds", () => {
    expect(priceForMinMargin(10_000, 1_000)).toBe(11_112);
    expect(enforceMinMargin(10_000, 10_500, 1_000)).toBe(11_112);
    expect(suggestUnitPrice(10_000, 2_000, 1_000)).toBe(12_000);
    expect(marginBps(10_000, 11_112)).toBeGreaterThanOrEqual(1_000);
  });

  it("extends a unit price by a milli-unit quantity", () => {
    expect(extendedCents(12_000, 2_000)).toBe(24_000);
    expect(extendedCents(6_000, 1_500)).toBe(9_000);
    expect(extendedCents(1, 1_500)).toBe(2);
    expect(extendedCents(1, 400)).toBe(0);
  });

  it("returns null margin when price is zero or cost is unknown", () => {
    expect(marginBps(0, 0)).toBeNull();
    expect(suggestUnitPrice(null, 2_000, 1_000)).toBeNull();
  });

  it("parses and formats quantities, dollars, and percents", () => {
    expect(parseQtyMilli("2")).toBe(2_000);
    expect(parseQtyMilli("1.5")).toBe(1_500);
    expect(parseQtyMilli("0")).toBeNull();
    expect(parseQtyMilli("1.2345")).toBeNull();
    expect(formatQty(1_500)).toBe("1.5");
    expect(formatQty(2_000)).toBe("2");
    expect(formatUsd(129_900)).toBe("$1,299.00");
    expect(formatUsd(-150)).toBe("-$1.50");
    expect(formatUsd(5)).toBe("$0.05");
    expect(parseDollarsToCents("$1,299.00")).toBe(129_900);
    expect(parseDollarsToCents("12.345")).toBe(1_235);
    expect(parseDollarsToCents("12.3")).toBe(1_230);
    expect(percentToBps("20")).toBe(2_000);
    expect(percentToBps("20.5%")).toBe(2_050);
    expect(formatPercentFromBps(1_667)).toBe("16.67%");
    expect(formatPercentFromBps(2_000)).toBe("20%");
  });
});
