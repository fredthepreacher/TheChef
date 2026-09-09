import Link from "next/link";
import { requireOperator } from "@/lib/auth/require-operator";
import { Empty } from "@/components/crm/Shared";
export default async function Dashboard() {
  const { db } = await requireOperator();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const next = new Date(now.getTime() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const results = await Promise.all([
    db
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(now.getTime() - 7 * 86400000).toISOString()),
    db
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "new_inquiry"),
    db
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("archived", false),
    db
      .from("events")
      .select("id", { count: "exact", head: true })
      .gte("event_date", today)
      .lte("event_date", next)
      .in("status", ["booked", "pre_event"]),
    db
      .from("leads")
      .select("id,event_type,requested_date,created_at")
      .eq("status", "new_inquiry")
      .order("created_at")
      .limit(10),
    db
      .from("events")
      .select("id,event_type,event_date,guest_count,status")
      .gte("event_date", today)
      .in("status", ["booked", "pre_event"])
      .order("event_date")
      .limit(8),
  ]);
  if (results.some((r) => r.error)) throw new Error("Dashboard could not load");
  const cards = [
    "New leads · last 7 days",
    "Awaiting first response",
    "Active clients",
    "Booked events · next 30 days",
  ];
  return (
    <>
      <p className="crm-eyebrow">Your catering business, organized</p>
      <h1>At a glance.</h1>
      <div className="crm-kpis">
        {cards.map((title, i) => (
          <div className="crm-panel" key={title}>
            <p>{title}</p>
            <strong>{results[i].count ?? 0}</strong>
          </div>
        ))}
      </div>
      <div className="crm-columns">
        <section>
          <h2>Action required</h2>
          {results[4].data?.length ? (
            results[4].data.map((l) => (
              <Link
                className="crm-panel crm-record"
                key={l.id}
                href={`/crm/leads/${l.id}`}
              >
                <h3>{l.event_type}</h3>
                <p>New inquiry · {l.requested_date}</p>
                <small>
                  Received {new Date(l.created_at).toLocaleDateString()}
                </small>
              </Link>
            ))
          ) : (
            <Empty>No new inquiries awaiting a first response.</Empty>
          )}
        </section>
        <section>
          <h2>Upcoming booked events</h2>
          {results[5].data?.length ? (
            results[5].data.map((e) => (
              <Link
                className="crm-panel crm-record"
                key={e.id}
                href={`/crm/events/${e.id}`}
              >
                <h3>{e.event_type}</h3>
                <p>
                  {e.event_date} · {e.guest_count} guests
                </p>
              </Link>
            ))
          ) : (
            <Empty>No upcoming booked events.</Empty>
          )}
        </section>
      </div>
      <p className="crm-muted">
        Financial, payment and readiness metrics will appear when those
        workflows are implemented.
      </p>
    </>
  );
}
