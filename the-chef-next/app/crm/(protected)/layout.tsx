import Link from "next/link";
import { requireOperator } from "@/lib/auth/require-operator";
import { logout } from "@/app/crm/actions";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role } = await requireOperator();
  return (
    <>
      <header className="crm-header">
        <Link href="/crm" className="crm-brand">
          The Chef <span>Catering operations</span>
        </Link>
        <span>{role}</span>
        <form action={logout}>
          <button className="crm-secondary">Sign out</button>
        </form>
      </header>
      <div className="crm-shell">
        <nav className="crm-nav" aria-label="CRM">
          <Link href="/crm">Overview</Link>
          <Link href="/crm/leads">Leads</Link>
          <Link href="/crm/clients">Clients</Link>
          <Link href="/crm/events">Catering events</Link>
          <Link href="/crm/calendar">Calendar</Link>
          <Link href="/crm/tasks">Tasks</Link>
          <Link href="/crm/venues">Venues</Link>
          <Link href="/">Public website ↗</Link>
        </nav>
        <main className="crm-main">{children}</main>
      </div>
    </>
  );
}
