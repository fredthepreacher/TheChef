import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOperator } from "@/lib/auth/require-operator";
import { stages, label, type Lead } from "@/lib/crm/domain";
import { updateStage, convertLead } from "@/app/crm/actions";
import { Activity, Notice } from "@/components/crm/Shared";
export default async function LeadDetail({
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
    .from("leads")
    .select("*,clients(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load lead");
  if (!data) notFound();
  const lead = data as Lead;
  const { data: communications, error: communicationsError } = await db
    .from("communications")
    .select("id,channel,subject,status,created_at,sent_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });
  if (communicationsError) throw new Error("Could not load communications");
  const p = await searchParams;
  return (
    <>
      <Link href="/crm/leads">← Leads</Link>
      <h1>
        {lead.clients.first_name} {lead.clients.last_name}
      </h1>
      <Notice {...p} />
      <p>
        {lead.event_type} · {lead.requested_date} · {lead.guest_count} guests
      </p>
      <Link href={`/crm/clients/${lead.client_id}`}>View client</Link>
      <div className="crm-columns">
        <section className="crm-panel">
          <h2>Pipeline</h2>
          <form action={updateStage}>
            <input type="hidden" name="id" value={id} />
            <label>
              Stage
              <select name="status" defaultValue={lead.status}>
                {stages.map((s) => (
                  <option value={s} key={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Lost reason (required when Lost)
              <textarea
                name="lost_reason"
                maxLength={1000}
                defaultValue={lead.lost_reason ?? ""}
              />
            </label>
            <button>Save stage</button>
          </form>
          <form action={convertLead}>
            <input type="hidden" name="id" value={id} />
            <button className="crm-secondary">
              Create / open event workspace
            </button>
          </form>
          <p className="crm-muted">
            Creating a prospective event does not confirm availability or take a
            payment.
          </p>
        </section>
        <section className="crm-panel">
          <h2>Original inquiry</h2>
          <dl>
            {Object.entries(lead.inquiry)
              .filter(([k]) => !["request_id", "consent"].includes(k))
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{label(k)}</dt>
                  <dd>{String(v) || "Not provided"}</dd>
                </div>
              ))}
          </dl>
        </section>
      </div>
      <section className="crm-panel">
        <h2>Communications</h2>
        {communications?.map((communication) => (
          <div className="crm-record-row" key={communication.id}>
            <span>
              <strong>{communication.subject}</strong>
              <small>
                {label(communication.channel)} · {label(communication.status)} ·{" "}
                {new Date(communication.created_at).toLocaleString()}
              </small>
            </span>
          </div>
        ))}
        {!communications?.length && <p>No communications recorded.</p>}
        {communications?.some(
          (communication) => communication.status === "queued",
        ) && (
          <p className="crm-muted">
            Queued acknowledgments have not been sent because an email provider
            is not configured.
          </p>
        )}
      </section>
      <Activity id={id} />
    </>
  );
}
