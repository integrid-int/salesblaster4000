import type { PgliteDatabase } from "drizzle-orm/pglite";
import type * as schema from "./schema";

export type AppDatabase = PgliteDatabase<typeof schema>;
