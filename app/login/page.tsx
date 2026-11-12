import { devBypassAllowed, entraConfigured } from "@/src/auth/policy";
import { buttonClass, inputClass, labelClass, secondaryButtonClass } from "@/src/ui/styles";
import { devSignIn, entraSignIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const dev = devBypassAllowed(process.env);
  const entra = entraConfigured(process.env);

  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-muted">Integrid</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Quotewright</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Sign in with the Integrid Microsoft tenant. Halo stays the system of record. This app
        builds the quote.
      </p>
      {error ? (
        <p className="mt-4 rounded-md border border-line bg-card px-3 py-2 text-sm text-danger">
          Sign-in did not complete. Use an @integrid.net address in development, or check the Entra
          app registration.
        </p>
      ) : null}
      <div className="mt-8 grid gap-4">
        {entra ? (
          <form action={entraSignIn}>
            <button className={buttonClass} type="submit">
              Sign in with Microsoft
            </button>
          </form>
        ) : (
          <p className="rounded-md border border-line bg-card px-3 py-3 text-sm leading-6">
            Microsoft Entra is not configured. The app needs{" "}
            <span className="font-mono text-xs">AUTH_MICROSOFT_ENTRA_ID_ID</span>, the client
            secret, and the Integrid tenant id. Callback URL:{" "}
            <span className="font-mono text-xs">/api/auth/callback/microsoft-entra-id</span>
          </p>
        )}
        {dev ? (
          <form action={devSignIn} className="grid gap-3 rounded-md border border-line bg-card p-4">
            <p className="text-sm leading-6">
              Development sign-in is on. It accepts only @integrid.net addresses and is refused
              when NODE_ENV is production.
            </p>
            <label className={labelClass}>
              Email
              <input className={inputClass} name="email" type="email" defaultValue="ryan@integrid.net" required />
            </label>
            <button className={secondaryButtonClass} type="submit">
              Continue
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
