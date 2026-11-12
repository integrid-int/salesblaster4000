export type Role = "seller" | "admin";

type Env = Record<string, string | undefined>;

export function devBypassAllowed(env: Env): boolean {
  return env.NODE_ENV !== "production" && env.AUTH_DEV_BYPASS === "1";
}

export function entraConfigured(env: Env): boolean {
  return Boolean(
    env.AUTH_MICROSOFT_ENTRA_ID_ID &&
      env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
      env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID,
  );
}

export function entraIssuer(env: Env): string {
  if (env.AUTH_MICROSOFT_ENTRA_ID_ISSUER) return env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;
  return `https://login.microsoftonline.com/${env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`;
}

export function adminEmailsFrom(env: Env): string[] {
  return (env.QUOTEWRIGHT_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

export function roleForEmail(email: string, adminEmails: readonly string[]): Role {
  const normalized = email.trim().toLowerCase();
  return adminEmails.some((admin) => admin.trim().toLowerCase() === normalized)
    ? "admin"
    : "seller";
}

export function tenantAllowed(tid: string | undefined | null, expected: string | undefined): boolean {
  if (!expected || !tid) return false;
  return tid.toLowerCase() === expected.toLowerCase();
}

export interface EntraProfileClaims {
  tid?: string | null;
  oid?: string | null;
  email?: string | null;
  preferred_username?: string | null;
  name?: string | null;
}

export function emailFromEntraProfile(profile: EntraProfileClaims): string | null {
  const value = profile.email || profile.preferred_username;
  if (!value || !value.includes("@")) return null;
  return value.trim().toLowerCase();
}

export function entraIdentityAccepted(
  profile: EntraProfileClaims,
  tenantId: string | undefined,
): { ok: true; oid: string; email: string; name: string | null } | { ok: false; reason: string } {
  if (!tenantAllowed(profile.tid, tenantId)) {
    return { ok: false, reason: "The Microsoft account is outside the Integrid tenant." };
  }
  if (!profile.oid) {
    return { ok: false, reason: "The Microsoft token did not include an object id." };
  }
  const email = emailFromEntraProfile(profile);
  if (!email) {
    return { ok: false, reason: "The Microsoft token did not include an email address." };
  }
  return { ok: true, oid: profile.oid, email, name: profile.name ?? null };
}

export function devBypassEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@integrid\.net$/.test(normalized)) return null;
  return normalized;
}

export function cronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = `Bearer ${secret}`;
  const actualBytes = Buffer.from(header);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actualBytes.length; index += 1) {
    mismatch |= actualBytes[index]! ^ expectedBytes[index]!;
  }
  return mismatch === 0;
}
