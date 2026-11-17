import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOperator } from "@/lib/auth/require-operator";
import { Activity, Notice } from "@/components/crm/Shared";
import { VenueForm } from "@/components/crm/VenueForm";
import type { Venue } from "@/lib/crm/domain";

export default async function VenueDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db } = await requireOperator();
  const [venueResult, eventsResult] = await Promise.all([
    db.from("venues").select("*").eq("id", id).maybeSingle(),
    db
      .from("events")
      .select("id,event_type,event_date,status,clients(first_name,last_name)")
      .eq("venue_id", id)
      .order("event_date"),
  ]);
  if (venueResult.error || eventsResult.error)
    throw new Error("Could not load venue");
  if (!venueResult.data) notFound();
  const venue = venueResult.data as Venue;
  return (
    <>
      <Link href="/crm/venues">← Venues</Link>
      <h1>{venue.name}</h1>
      <Notice {...(await searchParams)} />
      <div className="crm-columns">
        <section className="crm-panel">
          <h2>Venue details</h2>
          <VenueForm venue={venue} />
        </section>
        <section className="crm-panel">
          <h2>Linked events</h2>
          {eventsResult.data?.map((event) => {
            const client = event.clients as unknown as {
              first_name: string;
              last_name: string;
            };
            return (
              <p key={event.id}>
                <Link href={`/crm/events/${event.id}`}>
                  {event.event_date} · {event.event_type} · {client.first_name}{" "}
                  {client.last_name}
                </Link>
              </p>
            );
          })}
          {!eventsResult.data?.length && <p>No linked events yet.</p>}
          <p className="crm-muted">
            Updating this venue does not rewrite snapshots on existing events.
          </p>
        </section>
      </div>
      <Activity id={id} />
    </>
  );
}
