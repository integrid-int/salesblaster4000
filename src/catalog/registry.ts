import type { CatalogAdapter } from "../core/types";
import type { AppDatabase } from "../db/types";
import { createManualAdapter } from "../integrations/manual/adapter";

export function catalogAdapters(db: AppDatabase): CatalogAdapter[] {
  return [createManualAdapter(db)];
}
