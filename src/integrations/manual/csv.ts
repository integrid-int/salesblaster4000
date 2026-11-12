import { parseDollarsToCents } from "../../core/money";
import type { CatalogItem } from "../../core/types";

export interface ColumnMapping {
  sku: string;
  description: string;
  mfrPartNumber?: string;
  manufacturer?: string;
  cost?: string;
  msrp?: string;
  stock?: string;
}

export interface CsvImportError {
  line: number;
  message: string;
}

export interface CsvImportResult {
  items: CatalogItem[];
  errors: CsvImportError[];
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else if (char !== "\r") {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function headerIndex(headers: string[], name: string | undefined): number {
  if (!name) return -1;
  return headers.findIndex((header) => header.trim().toLowerCase() === name.trim().toLowerCase());
}

function cell(row: string[], index: number): string {
  if (index < 0) return "";
  return row[index]?.trim() ?? "";
}

export function importCsv(text: string, mapping: ColumnMapping, fetchedAt: string): CsvImportResult {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { items: [], errors: [{ line: 1, message: "The CSV is empty." }] };
  }
  const headers = rows[0] ?? [];
  const skuIndex = headerIndex(headers, mapping.sku);
  const descriptionIndex = headerIndex(headers, mapping.description);
  const errors: CsvImportError[] = [];
  if (skuIndex < 0) errors.push({ line: 1, message: `Missing SKU column "${mapping.sku}".` });
  if (descriptionIndex < 0) {
    errors.push({ line: 1, message: `Missing description column "${mapping.description}".` });
  }
  if (errors.length > 0) return { items: [], errors };

  const mpnIndex = headerIndex(headers, mapping.mfrPartNumber);
  const manufacturerIndex = headerIndex(headers, mapping.manufacturer);
  const costIndex = headerIndex(headers, mapping.cost);
  const msrpIndex = headerIndex(headers, mapping.msrp);
  const stockIndex = headerIndex(headers, mapping.stock);
  const items: CatalogItem[] = [];

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const line = index + 1;
    const sku = cell(row, skuIndex);
    const description = cell(row, descriptionIndex);
    if (!sku || !description) {
      errors.push({ line, message: "SKU and description are required." });
      continue;
    }
    const costRaw = cell(row, costIndex);
    const msrpRaw = cell(row, msrpIndex);
    const costCents = costRaw ? parseDollarsToCents(costRaw) : null;
    const msrpCents = msrpRaw ? parseDollarsToCents(msrpRaw) : null;
    if (costRaw && (costCents === null || costCents < 0)) {
      errors.push({ line, message: `Cost "${costRaw}" is not a dollar amount.` });
      continue;
    }
    if (msrpRaw && (msrpCents === null || msrpCents < 0)) {
      errors.push({ line, message: `MSRP "${msrpRaw}" is not a dollar amount.` });
      continue;
    }
    const stockRaw = cell(row, stockIndex);
    let stock: number | null = null;
    if (stockRaw) {
      if (!/^\d+$/.test(stockRaw)) {
        errors.push({ line, message: `Stock "${stockRaw}" is not a whole number.` });
        continue;
      }
      stock = Number(stockRaw);
    }
    items.push({
      source: "manual",
      sourceSku: sku,
      mfrPartNumber: cell(row, mpnIndex) || null,
      manufacturer: cell(row, manufacturerIndex) || null,
      description,
      costCents,
      msrpCents,
      stock,
      fetchedAt,
    });
  }

  return { items, errors };
}
