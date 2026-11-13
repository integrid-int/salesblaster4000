import Link from "next/link";
import { signOutAction } from "../auth/actions";
import type { Role } from "../auth/policy";

export function AppShell({
  user,
  children,
}: {
  user: { email?: string | null; role: Role };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <Link href="/quotes" className="font-semibold tracking-tight">
            Quotewright
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/quotes">Quotes</Link>
            <Link href="/catalog">Catalog</Link>
          </nav>
          <p className="ml-auto text-sm text-muted">
            {user.email} · {user.role}
          </p>
          <form action={signOutAction}>
            <button className="text-sm underline" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
