import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { outbox } from "../db/schema";
import type { AppDatabase } from "../db/types";

export interface OutboxJob {
  id: string;
  target: string;
  operation: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  attempts: number;
}

export type OutboxHandler = (job: OutboxJob) => Promise<void>;

export interface EnqueueInput {
  target: string;
  operation: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

export async function enqueueOutbox(
  db: AppDatabase,
  input: EnqueueInput,
): Promise<{ id: string; created: boolean }> {
  const [existing] = await db
    .select()
    .from(outbox)
    .where(eq(outbox.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (existing) return { id: existing.id, created: false };

  try {
    const [created] = await db
      .insert(outbox)
      .values({
        target: input.target,
        operation: input.operation,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
      })
      .returning();
    return { id: created!.id, created: true };
  } catch (error) {
    const [winner] = await db
      .select()
      .from(outbox)
      .where(eq(outbox.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (winner) return { id: winner.id, created: false };
    throw error;
  }
}

export interface DrainOptions {
  limit?: number;
  maxAttempts?: number;
  now?: Date;
  backoffMs?: (attempts: number) => number;
}

export interface DrainResult {
  claimed: number;
  succeeded: number;
  failed: number;
}

function handlerKey(target: string, operation: string): string {
  return `${target}.${operation}`;
}

export async function drainOutbox(
  db: AppDatabase,
  handlers: Record<string, OutboxHandler>,
  options: DrainOptions = {},
): Promise<DrainResult> {
  const limit = options.limit ?? 10;
  const maxAttempts = options.maxAttempts ?? 8;
  const now = options.now ?? new Date();
  const backoffMs = options.backoffMs ?? ((attempts: number) => Math.min(15 * 60_000, 2 ** attempts * 1_000));

  const claimed = await db.transaction(async (tx) => {
    const connection = tx as unknown as AppDatabase;
    const rows = await connection
      .select()
      .from(outbox)
      .where(and(eq(outbox.status, "pending"), lte(outbox.availableAt, now)))
      .orderBy(asc(outbox.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true });
    for (const row of rows) {
      await connection
        .update(outbox)
        .set({ status: "processing", attempts: row.attempts + 1, updatedAt: now })
        .where(eq(outbox.id, row.id));
    }
    return rows.map((row) => ({ ...row, attempts: row.attempts + 1 }));
  });

  let succeeded = 0;
  let failed = 0;
  for (const row of claimed) {
    const handler = handlers[handlerKey(row.target, row.operation)];
    try {
      if (!handler) {
        throw new Error(`No handler for ${row.target}.${row.operation}`);
      }
      await handler({
        id: row.id,
        target: row.target,
        operation: row.operation,
        payload: row.payload,
        idempotencyKey: row.idempotencyKey,
        attempts: row.attempts,
      });
      await db
        .update(outbox)
        .set({ status: "succeeded", lastError: null, updatedAt: new Date() })
        .where(eq(outbox.id, row.id));
      succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown outbox error";
      const dead = row.attempts >= maxAttempts;
      await db
        .update(outbox)
        .set({
          status: dead ? "dead" : "pending",
          lastError: message,
          availableAt: new Date(now.getTime() + backoffMs(row.attempts)),
          updatedAt: new Date(),
        })
        .where(eq(outbox.id, row.id));
      failed += 1;
    }
  }

  return { claimed: claimed.length, succeeded, failed };
}

export async function recoverStuck(db: AppDatabase, olderThan: Date): Promise<number> {
  const rows = await db
    .update(outbox)
    .set({ status: "pending", updatedAt: new Date() })
    .where(and(eq(outbox.status, "processing"), lte(outbox.updatedAt, olderThan)))
    .returning({ id: outbox.id });
  return rows.length;
}

export async function pendingCount(db: AppDatabase): Promise<number> {
  const rows = await db
    .select({ id: outbox.id })
    .from(outbox)
    .where(inArray(outbox.status, ["pending", "processing"]));
  return rows.length;
}
