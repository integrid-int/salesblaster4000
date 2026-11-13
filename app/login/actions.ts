"use server";

import { signIn } from "@/src/auth";

export async function devSignIn(formData: FormData) {
  await signIn("dev-bypass", {
    email: String(formData.get("email") ?? ""),
    redirectTo: "/quotes",
  });
}

export async function entraSignIn() {
  await signIn("microsoft-entra-id", { redirectTo: "/quotes" });
}
