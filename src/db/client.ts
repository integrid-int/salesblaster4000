import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { devBypassAllowed } from "../auth/policy";
import { seedSampleData } from "./seed";
import * as schema from "./schema";
import type { AppDatabase } from "./types";

const migrationsFolder = path.join(process.cwd(), "drizzle");
let opening: Promise<AppDatabase> | null = null;

export function getDb(): Promise<AppDatabase> {
  opening ??= openDb().catch((error: unknown) => {
    opening = null;
    throw error;
  });
  return opening;
}

async function openDb(): Promise<AppDatabase> {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (databaseUrl !== "") {
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder });
    if (devBypassAllowed(process.env)) await seedSampleData(db as unknown as AppDatabase);
    return db as unknown as AppDatabase;
  }

  const dataDir = path.join(process.cwd(), ".data", "pglite");
  await mkdir(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  if (devBypassAllowed(process.env)) {
    await seedSampleData(db);
  }
  return db;
}
