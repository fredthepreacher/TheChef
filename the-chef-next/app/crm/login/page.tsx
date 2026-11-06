import Link from "next/link";
import { configured } from "@/lib/supabase/server";
import { login } from "@/app/crm/actions";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="crm-login crm-panel">
      <p className="crm-eyebrow">The Chef Catering</p>
      <h1>Welcome back.</h1>
      <p>Private catering operations · invited accounts only</p>
      {!configured() ? (
        <p role="status">
          CRM setup is pending. Configure Supabase and provision an owner
          account using the setup guide.
        </p>
      ) : (
        <form action={login}>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={200}
            />
          </label>
          <button type="submit">Sign in</button>
        </form>
      )}
      {error && (
        <p role="alert">
          {error === "access"
            ? "This account does not have active owner or manager access. Ask the owner to review your access."
            : "Unable to sign in. Check your credentials or try again later."}
        </p>
      )}
      <Link href="/">Return to The Chef</Link>
    </main>
  );
}
