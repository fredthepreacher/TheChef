import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOperator } from "@/lib/auth/require-operator";
import { type CateringEvent, label } from "@/lib/crm/domain";
import { updateEvent } from "@/app/crm/actions";
import { Activity, Notice } from "@/components/crm/Shared";
export default async function EventDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db } = await requireOperator();
  const { data, error } = await db
    .from("events")
    .select("*,clients(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load event");
  if (!data) notFound();
  const event = data as CateringEvent;
  return (
    <>
      <Link href="/crm/events">← Catering events</Link>
      <h1>{event.event_type}</h1>
      <Notice {...await searchParams} />
      <p>
        <Link href={`/crm/clients/${event.client_id}`}>
          {event.clients.first_name} {event.clients.last_name}
        </Link>{" "}
        · <Link href={`/crm/leads/${event.lead_id}`}>Original inquiry</Link>
      </p>
      <div className="crm-columns">
        <section className="crm-panel">
          <h2>Event overview</h2>
          <form action={updateEvent}>
            <input type="hidden" name="id" value={id} />
            <label>
              Event date
              <input
                type="date"
                name="event_date"
                defaultValue={event.event_date}
                required
              />
            </label>
            <label>
              Guest count
              <input
                type="number"
                name="guest_count"
                min="1"
                max="10000"
                defaultValue={event.guest_count}
                required
              />
            </label>
            <label>
              Event status
              <select name="status" defaultValue={event.status}>
                {[
                  "prospective",
                  "booked",
                  "pre_event",
                  "completed",
                  "cancelled",
                  "archived",
                ].map((s) => (
                  <option value={s} key={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Internal notes
              <textarea
                name="internal_notes"
                maxLength={4000}
                defaultValue={event.internal_notes}
              />
            </label>
            <p className="crm-muted">
              Mark Booked only after you have confirmed the commitment with the
              client. Payments and contracts are not verified here.
            </p>
            <button>Save event</button>
          </form>
        </section>
        <section className="crm-panel">
          <h2>Package at inquiry</h2>
          <p>{String(event.package_snapshot.badge ?? "Custom")}</p>
          {Array.isArray(event.package_snapshot.features) && (
            <ul>
              {event.package_snapshot.features.map((f, i) => (
                <li key={i}>{String(f)}</li>
              ))}
            </ul>
          )}
          <h2>Requested menu</h2>
          <p>{String(event.menu_snapshot.menu_notes || "To be discussed")}</p>
          <h3>Dietary / allergy notes</h3>
          <p>
            {String(
              event.menu_snapshot.dietary_notes ||
                "Not provided; confirm with client",
            )}
          </p>
          <p className="crm-muted">
            Historical snapshot · menu not yet approved. Venue, COI, tasks and
            commercial workflows follow in Phase 2.
          </p>
        </section>
      </div>
      <Activity id={id} />
    </>
  );
}
