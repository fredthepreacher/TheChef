import { requireOperator } from "@/lib/auth/require-operator";
import { generateOperatorAssistance } from "@/app/crm/actions";
import { label } from "@/lib/crm/domain";
import { formatEtDateTime } from "@/lib/crm/time";

const generationTypes = [
  "event_summary","draft_inquiry_response","draft_quote_follow_up",
  "draft_booking_confirmation","draft_thank_you","missing_information","next_actions",
] as const;

export default async function AssistantPage({ searchParams }: {
  searchParams: Promise<{ event?: string; generation?: string; error?: string }>;
}) {
  const p = await searchParams;
  const { db } = await requireOperator();
  const { data: events, error } = await db.from("events")
    .select("id,event_type,event_date,clients(first_name,last_name)")
    .order("event_date", { ascending: false }).limit(200);
  if (error) throw new Error("Could not load events");
  const selectedEvent = p.event ?? events?.[0]?.id ?? "";
  const { data: generations } = selectedEvent
    ? await db.from("ai_generations").select("*").eq("event_id", selectedEvent).order("created_at", { ascending: false }).limit(20)
    : { data: [] };
  const selected = generations?.find((item) => item.id === p.generation) ?? generations?.[0];
  return <>
    <p className="crm-eyebrow">Operator assistance</p>
    <h1>AI assistant</h1>
    {p.error && <p className="crm-notice" role="alert">The assistant could not complete that request. Check the AI Gateway setup and try again.</p>}
    <section className="crm-panel">
      <p>AI output is a draft for operator review. It cannot update pricing, agreements, payments, booking status, menus, or COI decisions.</p>
      <form action={generateOperatorAssistance}>
        <label>Event<select name="event_id" defaultValue={selectedEvent} required>
          {events?.map((event) => {
            const client = event.clients as unknown as { first_name: string; last_name: string };
            return <option value={event.id} key={event.id}>{event.event_date} · {event.event_type} · {client.first_name} {client.last_name}</option>;
          })}
        </select></label>
        <label>Assistance type<select name="generation_type">
          {generationTypes.map((type) => <option value={type} key={type}>{label(type)}</option>)}
        </select></label>
        <button disabled={!events?.length}>Generate draft</button>
      </form>
    </section>
    {selected && <section className="crm-panel">
      <p className="crm-eyebrow">{label(selected.generation_type)} · {formatEtDateTime(selected.created_at)}</p>
      <div className="crm-agreement">{selected.output_text}</div>
      <p className="crm-muted">Model: {selected.model} · Review and edit before use. This output was not sent automatically.</p>
    </section>}
  </>;
}
