import { describe, expect, it } from "vitest";
import { importCsv, parseCsv } from "./csv";

const fetchedAt = "2026-11-12T00:00:00.000Z";
const mapping = {
  sku: "sku",
  description: "description",
  mfrPartNumber: "mpn",
  manufacturer: "manufacturer",
  cost: "cost",
  msrp: "msrp",
  stock: "stock",
};

describe("manual csv", () => {
  it("parses quoted commas and imports dollar costs as cents", () => {
    const text = [
      "sku,description,mpn,manufacturer,cost,msrp,stock",
      'FG-60F,"FortiGate 60F, firewall",FG-60F,Fortinet,"$1,250.00",1895.5,3',
      "BCK-M,Workstation backup,bck m,Acme,15.00,,",
    ].join("\n");
    expect(parseCsv(text)[1]?.[1]).toBe("FortiGate 60F, firewall");
    const result = importCsv(text, mapping, fetchedAt);
    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      source: "manual",
      sourceSku: "FG-60F",
      mfrPartNumber: "FG-60F",
      costCents: 125_000,
      msrpCents: 189_550,
      stock: 3,
      fetchedAt,
    });
    expect(result.items[1]).toMatchObject({
      sourceSku: "BCK-M",
      costCents: 1_500,
      msrpCents: null,
      stock: null,
    });
  });

  it("keeps valid rows when one row is incomplete", () => {
    const result = importCsv("sku,description\nOK,A firewall\n,Missing sku\n", mapping, fetchedAt);
    expect(result.items.map((item) => item.sourceSku)).toEqual(["OK"]);
    expect(result.errors).toEqual([{ line: 3, message: "SKU and description are required." }]);
  });

  it("reports a missing mapped column", () => {
    const result = importCsv("part,name\n1,Widget\n", mapping, fetchedAt);
    expect(result.items).toEqual([]);
    expect(result.errors[0]?.message).toContain("SKU");
  });
});
