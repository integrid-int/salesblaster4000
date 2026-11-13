"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { auth } from "@/src/auth";
import { getDb } from "@/src/db/client";
import { percentToBps } from "@/src/core/money";
import { QuoteError, createDraftQuote, saveDefaultPricingRule } from "@/src/quotes/commands";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

function fail(message: string): never {
  redirect(`/quotes?error=${encodeURIComponent(message)}`);
}

export async function createQuoteAction(formData: FormData) {
  const user = await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) fail("Choose a client.");
  try {
    const quote = await createDraftQuote(await getDb(), { clientId, createdById: user.id });
    revalidatePath("/quotes");
    redirect(`/quotes/${quote.id}`);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof QuoteError) fail(error.message);
    throw error;
  }
}

export async function savePricingRuleAction(formData: FormData) {
  const user = await requireUser();
  const markupBps = percentToBps(String(formData.get("markup") ?? ""));
  const minMarginBps = percentToBps(String(formData.get("minMargin") ?? ""));
  if (markupBps === null || minMarginBps === null) fail("Enter markup and minimum margin as percents.");
  try {
    await saveDefaultPricingRule(await getDb(), { markupBps, minMarginBps, role: user.role });
    revalidatePath("/quotes");
    redirect("/quotes");
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof QuoteError) fail(error.message);
    throw error;
  }
}
