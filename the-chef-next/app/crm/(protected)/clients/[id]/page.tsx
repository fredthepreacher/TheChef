import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOperator } from "@/lib/auth/require-operator";
import { Activity, Notice } from "@/components/crm/Shared";
import { updateClient } from "@/app/crm/actions";
export default async function ClientDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db } = await requireOperator();
  const [c, l, e] = await Promise.all([
    db.from("clients").select("*").eq("id", id).maybeSingle(),
    db
      .from("leads")
      .select("id,event_type,status,requested_date")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("events")
      .select("id,event_type,event_date,status")
      .eq("client_id", id)
      .order("event_date", { ascending: false }),
  ]);
  if (c.error || l.error || e.error) throw new Error("Could not load client");
  if (!c.data) notFound();
  const client = c.data;
  return (
    <>
      <Link href="/crm/clients">← Clients</Link>
      <h1>
        {client.first_name} {client.last_name}
      </h1>
      <Notice {...await searchParams} />
      <div className="crm-columns">
        <section className="crm-panel">
          <h2>Contact</h2>
          <p>
            <a href={`mailto:${client.email}`}>{client.email}</a>
          </p>
          <p>
            <a href={`tel:${client.phone}`}>{client.phone}</a>
          </p>
          <p>Preferred contact: {client.preferred_contact_method}</p>
          <form action={updateClient}>
            <input type="hidden" name="id" value={id} />
            <label>
              Internal notes
              <textarea
                name="notes"
                maxLength={4000}
                defaultValue={client.notes}
              />
            </label>
            <label>
              Record state
              <select name="archived" defaultValue={String(client.archived)}>
                <option value="false">Active</option>
                <option value="true">Archived</option>
              </select>
            </label>
            <button>Save client</button>
          </form>
        </section>
        <section className="crm-panel">
          <h2>Events ({e.data?.length ?? 0})</h2>
          {e.data?.map((event) => (
            <p key={event.id}>
              <Link href={`/crm/events/${event.id}`}>
                {event.event_date} · {event.event_type} · {event.status}
              </Link>
            </p>
          ))}
          {!e.data?.length && <p>No event workspaces yet.</p>}
          <h2>Inquiry history</h2>
          {l.data?.map((lead) => (
            <p key={lead.id}>
              <Link href={`/crm/leads/${lead.id}`}>
                {lead.requested_date} · {lead.event_type} · {lead.status}
              </Link>
            </p>
          ))}
        </section>
      </div>
      <Activity id={id} />
    </>
  );
}
