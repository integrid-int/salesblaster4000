import { drainOutbox, recoverStuck } from "@/src/core/outbox";
import { cronAuthorized } from "@/src/auth/policy";
import { getDb } from "@/src/db/client";

export const dynamic = "force-dynamic";

async function run(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const stuckBefore = new Date(Date.now() - 15 * 60_000);
  const recovered = await recoverStuck(db, stuckBefore);
  const result = await drainOutbox(db, {});
  return Response.json({ recovered, ...result });
}

export function GET(request: Request) {
  return run(request);
}

export function POST(request: Request) {
  return run(request);
}
