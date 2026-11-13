import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import {
  adminEmailsFrom,
  devBypassAllowed,
  devBypassEmail,
  entraConfigured,
  entraIdentityAccepted,
  entraIssuer,
  roleForEmail,
  type EntraProfileClaims,
} from "./policy";
import { upsertUser } from "./users";

const bypass = devBypassAllowed(process.env);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? (bypass ? "dev-bypass-secret" : undefined),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    ...(entraConfigured(process.env)
      ? [
          MicrosoftEntraID({
            clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
            issuer: entraIssuer(process.env),
          }),
        ]
      : []),
    ...(bypass
      ? [
          Credentials({
            id: "dev-bypass",
            name: "Development bypass",
            credentials: {
              email: { label: "Email", type: "email" },
            },
            authorize: async (credentials) => {
              if (!devBypassAllowed(process.env)) return null;
              const email = devBypassEmail(String(credentials?.email ?? ""));
              if (!email) return null;
              const role = roleForEmail(email, adminEmailsFrom(process.env));
              const user = await upsertUser({
                entraOid: `dev:${email}`,
                email,
                name: email,
                role,
              });
              return { id: user.id, email, name: user.name, role: user.role, entraOid: user.entraOid };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "dev-bypass") return devBypassAllowed(process.env);
      if (account?.provider !== "microsoft-entra-id") return false;
      const decision = entraIdentityAccepted(
        (profile ?? {}) as EntraProfileClaims,
        process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID,
      );
      return decision.ok;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "microsoft-entra-id" && profile) {
        const decision = entraIdentityAccepted(
          profile as EntraProfileClaims,
          process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID,
        );
        if (decision.ok) {
          const role = roleForEmail(decision.email, adminEmailsFrom(process.env));
          const saved = await upsertUser({
            entraOid: decision.oid,
            email: decision.email,
            name: decision.name,
            role,
          });
          token.uid = saved.id;
          token.role = saved.role;
          token.entraOid = saved.entraOid;
        }
      } else if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.entraOid = user.entraOid;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.uid === "string" ? token.uid : "";
        session.user.role = token.role === "admin" || token.role === "seller" ? token.role : "seller";
        session.user.entraOid = typeof token.entraOid === "string" ? token.entraOid : "";
      }
      return session;
    },
  },
});
