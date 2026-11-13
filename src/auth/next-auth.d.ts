import type { DefaultSession } from "next-auth";
import type { Role } from "./policy";

declare module "next-auth" {
  interface User {
    role: Role;
    entraOid: string;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      entraOid: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
    entraOid?: string;
  }
}
