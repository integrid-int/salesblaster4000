import { describe, expect, it } from "vitest";
import { normalizeMpn } from "./mpn";

describe("normalizeMpn", () => {
  it("strips separators and case so the same part merges", () => {
    expect(normalizeMpn("fg-60f")).toBe("FG60F");
    expect(normalizeMpn("FG 60F")).toBe("FG60F");
    expect(normalizeMpn("  ")).toBeNull();
    expect(normalizeMpn(null)).toBeNull();
  });
});
