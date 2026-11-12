const BPS_SCALE = 10_000;
const QTY_SCALE = 1_000;

export function assertSafeInt(name: string, value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a safe integer`);
  }
}

function signedRound(amount: number, numerator: number, denominator: number): number {
  assertSafeInt("amount", amount);
  assertSafeInt("numerator", numerator);
  assertSafeInt("denominator", denominator);
  if (denominator === 0) {
    throw new Error("denominator must not be zero");
  }
  const negative = amount < 0 !== numerator < 0;
  const absoluteAmount = BigInt(Math.abs(amount));
  const absoluteNumerator = BigInt(Math.abs(numerator));
  const absoluteDenominator = BigInt(Math.abs(denominator));
  const rounded =
    (absoluteAmount * absoluteNumerator + absoluteDenominator / BigInt(2)) / absoluteDenominator;
  const result = Number(rounded);
  return negative ? -result : result;
}

export function mulDivRound(amount: number, numerator: number, denominator: number): number {
  return signedRound(amount, numerator, denominator);
}

export function mulDivCeil(amount: number, numerator: number, denominator: number): number {
  assertSafeInt("amount", amount);
  assertSafeInt("numerator", numerator);
  assertSafeInt("denominator", denominator);
  if (amount < 0 || numerator < 0 || denominator <= 0) {
    throw new Error("ceil division expects positive inputs");
  }
  const product = BigInt(amount) * BigInt(numerator);
  const divisor = BigInt(denominator);
  return Number((product + divisor - BigInt(1)) / divisor);
}

export function applyMarkup(costCents: number, markupBps: number): number {
  if (costCents < 0) throw new Error("cost cannot be negative");
  if (markupBps < 0) throw new Error("markup cannot be negative");
  return mulDivRound(costCents, BPS_SCALE + markupBps, BPS_SCALE);
}

export function priceForMinMargin(costCents: number, minMarginBps: number): number {
  if (costCents < 0) throw new Error("cost cannot be negative");
  if (minMarginBps < 0 || minMarginBps >= BPS_SCALE) {
    throw new Error("minimum margin must be from 0% through 99.99%");
  }
  if (costCents === 0) return 0;
  return mulDivCeil(costCents, BPS_SCALE, BPS_SCALE - minMarginBps);
}

export function enforceMinMargin(
  costCents: number,
  priceCents: number,
  minMarginBps: number,
): number {
  if (priceCents < 0) throw new Error("price cannot be negative");
  return Math.max(priceCents, priceForMinMargin(costCents, minMarginBps));
}

export function suggestUnitPrice(
  costCents: number | null,
  markupBps: number,
  minMarginBps: number,
): number | null {
  if (costCents === null) return null;
  return enforceMinMargin(costCents, applyMarkup(costCents, markupBps), minMarginBps);
}

export function marginBps(costCents: number, priceCents: number): number | null {
  if (priceCents <= 0 || costCents < 0) return null;
  return mulDivRound(priceCents - costCents, BPS_SCALE, priceCents);
}

export function extendedCents(unitCents: number, qtyMilli: number): number {
  if (qtyMilli < 0) throw new Error("quantity cannot be negative");
  return mulDivRound(unitCents, qtyMilli, QTY_SCALE);
}

export function parseQtyMilli(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const milli = Number(whole) * QTY_SCALE + Number(fraction.padEnd(3, "0"));
  if (!Number.isSafeInteger(milli) || milli <= 0) return null;
  return milli;
}

export function formatQty(qtyMilli: number): string {
  assertSafeInt("qtyMilli", qtyMilli);
  const sign = qtyMilli < 0 ? "-" : "";
  const absolute = Math.abs(qtyMilli);
  const whole = Math.floor(absolute / QTY_SCALE);
  const fraction = String(absolute % QTY_SCALE)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

export function formatUsd(cents: number): string {
  assertSafeInt("cents", cents);
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const remainder = String(absolute % 100).padStart(2, "0");
  return `${sign}$${dollars}.${remainder}`;
}

export function parseDollarsToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const negative = trimmed.startsWith("-") || /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed.replace(/[()$,\s]/g, "").replace(/^-/, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const digits = `${fraction}000`;
  const base = Number(whole) * 100 + Number(digits.slice(0, 2));
  const cents = base + (Number(digits[2]) >= 5 ? 1 : 0);
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

export function percentToBps(input: string): number | null {
  const trimmed = input.trim().replace(/%$/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(bps)) return null;
  return bps;
}

export function formatPercentFromBps(bps: number): string {
  assertSafeInt("bps", bps);
  const sign = bps < 0 ? "-" : "";
  const absolute = Math.abs(bps);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return fraction ? `${sign}${whole}.${fraction}%` : `${sign}${whole}%`;
}
