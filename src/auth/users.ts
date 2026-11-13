import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { getDb } from "../db/client";
import type { Role } from "./policy";

export async function upsertUser(input: {
  entraOid: string;
  email: string;
  name: string | null;
  role: Role;
}) {
  const db = await getDb();
  const [existing] = await db.select().from(users).where(eq(users.entraOid, input.entraOid)).limit(1);
  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        email: input.email,
        name: input.name,
        role: input.role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated!;
  }
  const [created] = await db
    .insert(users)
    .values({
      entraOid: input.entraOid,
      email: input.email,
      name: input.name,
      role: input.role,
    })
    .returning();
  return created!;
}
