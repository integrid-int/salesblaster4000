import { redirect } from "next/navigation";
import { auth } from "@/src/auth";
import { AppShell } from "@/src/ui/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <AppShell user={session.user}>{children}</AppShell>;
}
