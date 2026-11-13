"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { auth } from "@/src/auth";
import { parseDollarsToCents } from "@/src/core/money";
import { getDb } from "@/src/db/client";
import { handEnteredItem, importAndSaveCsv, saveManualItems } from "@/src/integrations/manual/adapter";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

export async function importCsvAction(formData: FormData) {
  await requireUser();
  const text = String(formData.get("csv") ?? "");
  const result = await importAndSaveCsv(await getDb(), text, {
    sku: String(formData.get("sku") ?? "sku"),
    description: String(formData.get("description") ?? "description"),
    mfrPartNumber: String(formData.get("mpn") ?? "mpn"),
    manufacturer: String(formData.get("manufacturer") ?? "manufacturer"),
    cost: String(formData.get("cost") ?? "cost"),
    msrp: String(formData.get("msrp") ?? "msrp"),
    stock: String(formData.get("stock") ?? "stock"),
  });
  revalidatePath("/catalog");
  const summary =
    result.errors.length > 0
      ? `Imported ${result.items.length}. ${result.errors.map((error) => `Line ${error.line}: ${error.message}`).join(" ")}`
      : `Imported ${result.items.length} item${result.items.length === 1 ? "" : "s"}.`;
  redirect(`/catalog?notice=${encodeURIComponent(summary)}`);
}

export async function handEntryAction(formData: FormData) {
  await requireUser();
  const costRaw = String(formData.get("cost") ?? "").trim();
  const msrpRaw = String(formData.get("msrp") ?? "").trim();
  const stockRaw = String(formData.get("stock") ?? "").trim();
  const costCents = costRaw ? parseDollarsToCents(costRaw) : null;
  const msrpCents = msrpRaw ? parseDollarsToCents(msrpRaw) : null;
  if (costRaw && (costCents === null || costCents < 0)) {
    redirect("/catalog?notice=Cost%20must%20be%20a%20dollar%20amount.");
  }
  if (msrpRaw && (msrpCents === null || msrpCents < 0)) {
    redirect("/catalog?notice=MSRP%20must%20be%20a%20dollar%20amount.");
  }
  if (stockRaw && !/^\d+$/.test(stockRaw)) {
    redirect("/catalog?notice=Stock%20must%20be%20a%20whole%20number.");
  }
  try {
    const item = handEnteredItem({
      sku: String(formData.get("sku") ?? ""),
      description: String(formData.get("itemDescription") ?? ""),
      mfrPartNumber: String(formData.get("partNumber") ?? ""),
      manufacturer: String(formData.get("maker") ?? ""),
      costCents,
      msrpCents,
      stock: stockRaw ? Number(stockRaw) : null,
      fetchedAt: new Date().toISOString(),
    });
    await saveManualItems(await getDb(), [item]);
  } catch (error) {
    unstable_rethrow(error);
    const message = error instanceof Error ? error.message : "The item could not be saved.";
    redirect(`/catalog?notice=${encodeURIComponent(message)}`);
  }
  revalidatePath("/catalog");
  redirect(`/catalog?q=${encodeURIComponent(String(formData.get("sku") ?? ""))}&notice=Saved.`);
}
