import { describe, expect, it } from "vitest";
import type { CatalogAdapter, CatalogItem } from "../core/types";
import { mergeOffers, searchCatalog } from "./search";

function item(overrides: Partial<CatalogItem> & Pick<CatalogItem, "source" | "sourceSku">): CatalogItem {
  return {
    mfrPartNumber: null,
    manufacturer: null,
    description: overrides.sourceSku,
    costCents: null,
    msrpCents: null,
    stock: null,
    fetchedAt: "2026-11-12T00:00:00.000Z",
    ...overrides,
  };
}

function adapter(id: string, search: CatalogAdapter["search"]): CatalogAdapter {
  return {
    id,
    search,
    async priceAndAvailability() {
      return [];
    },
    async healthCheck() {
      return { ok: true, checkedAt: "2026-11-12T00:00:00.000Z" };
    },
  };
}

describe("catalog search", () => {
  it("merges offers on the normalized manufacturer part number", () => {
    const products = mergeOffers([
      item({ source: "dandh", sourceSku: "D1", mfrPartNumber: "FG-60F", costCents: 70_000, description: "Short" }),
      item({
        source: "ingram",
        sourceSku: "I1",
        mfrPartNumber: "fg 60f",
        costCents: 61_000,
        description: "FortiGate 60F firewall",
      }),
      item({ source: "manual", sourceSku: "LOCAL", description: "Labor" }),
    ]);
    expect(products).toHaveLength(2);
    const firewall = products.find((product) => product.offers.length === 2);
    expect(firewall?.description).toBe("FortiGate 60F firewall");
    expect(firewall?.offers.map((offer) => offer.source)).toEqual(["ingram", "dandh"]);
  });

  it("returns the sources that succeeded when one source fails or times out", async () => {
    const result = await searchCatalog(
      [
        adapter("manual", async () => [item({ source: "manual", sourceSku: "A", description: "Firewall" })]),
        adapter("dandh", async () => {
          throw new Error("token expired");
        }),
        adapter(
          "ingram",
          () => new Promise(() => {}),
        ),
      ],
      "firewall",
      { timeoutMs: 20 },
    );
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.offers[0]?.sourceSku).toBe("A");
    expect(result.failures.map((failure) => failure.source).sort()).toEqual(["dandh", "ingram"]);
    expect(result.failures.find((failure) => failure.source === "ingram")?.message).toContain("timed out");
  });
});
