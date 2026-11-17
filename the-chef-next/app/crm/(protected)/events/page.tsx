import Link from "next/link";
import { requireOperator } from "@/lib/auth/require-operator";
import { type CateringEvent, label } from "@/lib/crm/domain";
import { Empty, Search, Notice } from "@/components/crm/Shared";
export default async function Events({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>;
}) {
  const p = await searchParams;
  const { db } = await requireOperator();
  const { data, error } = await db
    .from("events")
    .select("*,clients(*)")
    .order("event_date", { ascending: false })
    .limit(200);
  if (error) throw new Error("Could not load events");
  const events = (data as CateringEvent[]).filter((e) =>
    `${e.clients.first_name} ${e.clients.last_name} ${e.event_type}`
      .toLowerCase()
      .includes((p.q ?? "").toLowerCase()),
  );
  return (
    <>
      <p className="crm-eyebrow">Every occasion, accounted for</p>
      <h1>Catering events</h1>
      <Notice error={p.error} />
      <Search value={p.q} />
      <div className="crm-grid">
        {events.map((e) => (
          <Link
            className="crm-panel crm-record"
            key={e.id}
            href={`/crm/events/${e.id}`}
          >
            <h2>{e.event_type}</h2>
            <p>
              {e.clients.first_name} {e.clients.last_name}
            </p>
            <p>
              {e.event_date} · {e.guest_count} guests
            </p>
            <span className="crm-chip">{label(e.status)}</span>
          </Link>
        ))}
      </div>
      {!events.length && (
        <Empty>
          No matching events. Open a lead to create a prospective event
          workspace.
        </Empty>
      )}
      <p className="crm-muted">Showing up to 200 most recent event dates.</p>
    </>
  );
}
