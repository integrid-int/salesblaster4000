import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { outbox } from "../db/schema";
import { createTestDb } from "../db/test-db";
import { drainOutbox, enqueueOutbox, recoverStuck } from "./outbox";

describe("outbox", () => {
  it("enqueues once per idempotency key and does not rerun a success", async () => {
    const db = await createTestDb();
    const first = await enqueueOutbox(db, {
      target: "halo",
      operation: "createQuotation",
      payload: { quoteId: "q1" },
      idempotencyKey: "halo:createQuotation:q1",
    });
    const second = await enqueueOutbox(db, {
      target: "halo",
      operation: "createQuotation",
      payload: { quoteId: "q1" },
      idempotencyKey: "halo:createQuotation:q1",
    });
    expect(second).toEqual({ id: first.id, created: false });

    let calls = 0;
    const drained = await drainOutbox(
      db,
      {
        "halo.createQuotation": async () => {
          calls += 1;
        },
      },
      { backoffMs: () => 0 },
    );
    expect(drained).toEqual({ claimed: 1, succeeded: 1, failed: 0 });
    await drainOutbox(db, { "halo.createQuotation": async () => { calls += 1; } });
    expect(calls).toBe(1);
  });

  it("retries a failure and then marks the job dead", async () => {
    const db = await createTestDb();
    await enqueueOutbox(db, {
      target: "halo",
      operation: "createQuotation",
      payload: {},
      idempotencyKey: "halo:fail",
    });
    const handlers = {
      "halo.createQuotation": async () => {
        throw new Error("halo unavailable");
      },
    };
    const first = await drainOutbox(db, handlers, { maxAttempts: 2, backoffMs: () => 0 });
    expect(first.failed).toBe(1);
    const [pending] = await db.select().from(outbox).where(eq(outbox.idempotencyKey, "halo:fail"));
    expect(pending?.status).toBe("pending");
    expect(pending?.lastError).toBe("halo unavailable");
    expect(pending?.attempts).toBe(1);

    const second = await drainOutbox(db, handlers, { maxAttempts: 2, backoffMs: () => 0 });
    expect(second.failed).toBe(1);
    const [dead] = await db.select().from(outbox).where(eq(outbox.idempotencyKey, "halo:fail"));
    expect(dead?.status).toBe("dead");
    expect(dead?.attempts).toBe(2);
  });

  it("fails closed when no handler is registered and can recover a stuck claim", async () => {
    const db = await createTestDb();
    await enqueueOutbox(db, {
      target: "benji",
      operation: "recordPayment",
      payload: {},
      idempotencyKey: "benji:1",
    });
    const result = await drainOutbox(db, {}, { backoffMs: () => 60_000 });
    expect(result.failed).toBe(1);
    const [row] = await db.select().from(outbox);
    expect(row?.lastError).toContain("No handler");

    await db.update(outbox).set({ status: "processing", updatedAt: new Date("2020-01-01") });
    expect(await recoverStuck(db, new Date("2021-01-01"))).toBe(1);
    const [recovered] = await db.select().from(outbox);
    expect(recovered?.status).toBe("pending");
  });
});
