import { describe, expect, it } from "vitest";
import {
  cronAuthorized,
  devBypassAllowed,
  devBypassEmail,
  entraConfigured,
  entraIdentityAccepted,
  entraIssuer,
  roleForEmail,
} from "./policy";

describe("auth policy", () => {
  it("refuses the development bypass in production", () => {
    expect(devBypassAllowed({ NODE_ENV: "production", AUTH_DEV_BYPASS: "1" })).toBe(false);
    expect(devBypassAllowed({ NODE_ENV: "development", AUTH_DEV_BYPASS: "1" })).toBe(true);
    expect(devBypassAllowed({ NODE_ENV: "development", AUTH_DEV_BYPASS: "true" })).toBe(false);
  });

  it("requires the Entra client, secret, and tenant together", () => {
    expect(
      entraConfigured({
        AUTH_MICROSOFT_ENTRA_ID_ID: "id",
        AUTH_MICROSOFT_ENTRA_ID_SECRET: "secret",
      }),
    ).toBe(false);
    expect(
      entraConfigured({
        AUTH_MICROSOFT_ENTRA_ID_ID: "id",
        AUTH_MICROSOFT_ENTRA_ID_SECRET: "secret",
        AUTH_MICROSOFT_ENTRA_ID_TENANT_ID: "tenant",
      }),
    ).toBe(true);
  });

  it("pins the issuer to the Integrid tenant", () => {
    expect(entraIssuer({ AUTH_MICROSOFT_ENTRA_ID_TENANT_ID: "tenant-id" })).toBe(
      "https://login.microsoftonline.com/tenant-id/v2.0",
    );
    expect(
      entraIssuer({
        AUTH_MICROSOFT_ENTRA_ID_TENANT_ID: "tenant-id",
        AUTH_MICROSOFT_ENTRA_ID_ISSUER: "https://login.microsoftonline.com/tenant-id/v2.0/",
      }),
    ).toBe("https://login.microsoftonline.com/tenant-id/v2.0/");
  });

  it("accepts only the configured tenant and a real email", () => {
    expect(
      entraIdentityAccepted(
        { tid: "TENANT", oid: "oid-1", preferred_username: "Ada@Integrid.net", name: "Ada" },
        "tenant",
      ),
    ).toEqual({ ok: true, oid: "oid-1", email: "ada@integrid.net", name: "Ada" });
    expect(entraIdentityAccepted({ tid: "other", oid: "oid-1", email: "a@integrid.net" }, "tenant")).toMatchObject({
      ok: false,
    });
    expect(entraIdentityAccepted({ tid: "tenant", email: "a@integrid.net" }, "tenant")).toMatchObject({
      ok: false,
    });
    expect(entraIdentityAccepted({ tid: "tenant", oid: "oid-1" }, undefined)).toMatchObject({ ok: false });
  });

  it("assigns admin from the email list and limits the dev form to Integrid mail", () => {
    expect(roleForEmail("Ryan@Integrid.net", ["ryan@integrid.net"])).toBe("admin");
    expect(roleForEmail("seller@integrid.net", ["ryan@integrid.net"])).toBe("seller");
    expect(devBypassEmail("seller@integrid.net")).toBe("seller@integrid.net");
    expect(devBypassEmail("seller@example.com")).toBeNull();
  });

  it("authorizes the cron bearer without a prefix match", () => {
    expect(cronAuthorized("Bearer secret", "secret")).toBe(true);
    expect(cronAuthorized("Bearer secret-extra", "secret")).toBe(false);
    expect(cronAuthorized("Bearer wrong", "secret")).toBe(false);
    expect(cronAuthorized("Bearer secret", undefined)).toBe(false);
  });
});
