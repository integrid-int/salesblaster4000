"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { auth } from "@/src/auth";
import { parseDollarsToCents, parseQtyMilli } from "@/src/core/money";
import { getDb } from "@/src/db/client";
import {
  QuoteError,
  addCatalogLine,
  addHandEnteredLine,
  addSection,
  removeLine,
  updateLine,
} from "@/src/quotes/commands";
import type { Billing } from "@/src/quotes/totals";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

function billingOf(value: FormDataEntryValue | null): Billing {
  if (value === "monthly" || value === "annual" || value === "once") return value;
  return "once";
}

async function back(quoteId: string, error?: unknown): Promise<never> {
  unstable_rethrow(error);
  const message = error instanceof QuoteError ? error.message : "The quote could not be updated.";
  redirect(`/quotes/${quoteId}?error=${encodeURIComponent(message)}`);
}

export async function addSectionAction(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");
  await requireUser();
  try {
    await addSection(await getDb(), { quoteId, title: String(formData.get("title") ?? "") });
    revalidatePath(`/quotes/${quoteId}`);
    redirect(`/quotes/${quoteId}`);
  } catch (error) {
    await back(quoteId, error);
  }
}

export async function addCatalogLineAction(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");
  await requireUser();
  const qtyMilli = parseQtyMilli(String(formData.get("qty") ?? "1"));
  if (qtyMilli === null) await back(quoteId, new QuoteError("Quantity must be a positive number."));
  try {
    await addCatalogLine(await getDb(), {
      sectionId: String(formData.get("sectionId") ?? ""),
      catalogItemId: String(formData.get("catalogItemId") ?? ""),
      qtyMilli: qtyMilli!,
      billing: billingOf(formData.get("billing")),
      optional: formData.get("optional") === "on",
    });
    revalidatePath(`/quotes/${quoteId}`);
    redirect(`/quotes/${quoteId}`);
  } catch (error) {
    await back(quoteId, error);
  }
}

export async function addHandLineAction(formData: FormData) {
  const user = await requireUser();
  const quoteId = String(formData.get("quoteId") ?? "");
  const qtyMilli = parseQtyMilli(String(formData.get("qty") ?? "1"));
  const costRaw = String(formData.get("cost") ?? "").trim();
  const price = parseDollarsToCents(String(formData.get("price") ?? ""));
  const costCents = costRaw ? parseDollarsToCents(costRaw) : null;
  if (qtyMilli === null) await back(quoteId, new QuoteError("Quantity must be a positive number."));
  if (price === null) await back(quoteId, new QuoteError("Enter a unit price."));
  if (costRaw && costCents === null) await back(quoteId, new QuoteError("Cost must be a dollar amount."));
  try {
    await addHandEnteredLine(await getDb(), {
      sectionId: String(formData.get("sectionId") ?? ""),
      sku: String(formData.get("sku") ?? ""),
      description: String(formData.get("description") ?? ""),
      mfrPartNumber: String(formData.get("mpn") ?? ""),
      manufacturer: String(formData.get("manufacturer") ?? ""),
      costCents,
      priceCents: price!,
      qtyMilli: qtyMilli!,
      billing: billingOf(formData.get("billing")),
      optional: formData.get("optional") === "on",
      role: user.role,
    });
    revalidatePath(`/quotes/${quoteId}`);
    redirect(`/quotes/${quoteId}`);
  } catch (error) {
    await back(quoteId, error);
  }
}

export async function updateLineAction(formData: FormData) {
  const user = await requireUser();
  const quoteId = String(formData.get("quoteId") ?? "");
  try {
    await updateLine(await getDb(), {
      lineId: String(formData.get("lineId") ?? ""),
      role: user.role,
      qty: String(formData.get("qty") ?? ""),
      price: String(formData.get("price") ?? ""),
      billing: billingOf(formData.get("billing")),
      optional: formData.get("optional") === "on",
      selected: formData.get("selected") === "on",
    });
    revalidatePath(`/quotes/${quoteId}`);
    redirect(`/quotes/${quoteId}`);
  } catch (error) {
    await back(quoteId, error);
  }
}

export async function removeLineAction(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");
  await requireUser();
  try {
    await removeLine(await getDb(), String(formData.get("lineId") ?? ""));
    revalidatePath(`/quotes/${quoteId}`);
    redirect(`/quotes/${quoteId}`);
  } catch (error) {
    await back(quoteId, error);
  }
}
