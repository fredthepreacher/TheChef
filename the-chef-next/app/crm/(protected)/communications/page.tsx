import { requireOperator } from "@/lib/auth/require-operator";
import { decideScheduledAction, processDueAutomations, sendQueuedEmails, updateAutomationRule } from "@/app/crm/actions";
import { label } from "@/lib/crm/domain";
import { Notice } from "@/components/crm/Shared";

type ScheduledAction = { id: string; name: string; action_key: string; entity_type: string; entity_id: string; due_at: string; status: string; last_error: string | null };

export default async function CommunicationsPage({ searchParams }: {
  searchParams: Promise<{ error?: string; saved?: string; processed?: string; sent?: string }>;
}) {
  const p = await searchParams;
  const { db } = await requireOperator();
  const [{ data: communications, error }, { data: rules }, { data: scheduled }] = await Promise.all([
    db.from("communications").select("*").order("created_at", { ascending: false }).limit(200),
    db.from("automation_rules").select("*").order("name"),
    db.rpc("list_scheduled_actions"),
  ]);
  if (error) throw new Error("Could not load communications");
  return <>
    <p className="crm-eyebrow">Durable delivery and follow-up</p>
    <h1>Communications</h1>
    <Notice error={p.error} saved={p.saved || p.processed || p.sent} />
    <section className="crm-panel">
      <div className="crm-section-heading"><div><h2>Automation rules</h2><p className="crm-muted">Rules begin disabled. Every current rule requires operator approval.</p></div></div>
      {rules?.map((rule) => <div className="crm-record-row" key={rule.id}>
        <span><strong>{rule.name}</strong><small>{label(rule.trigger_key)} → {label(rule.action_key)} · {rule.delay_minutes} minute delay · approval required</small></span>
        <form action={updateAutomationRule}><input type="hidden" name="id" value={rule.id} /><button name="active" value={String(!rule.active)} className="crm-secondary">{rule.active ? "Disable" : "Enable"}</button></form>
      </div>)}
    </section>
    <section className="crm-panel">
      <div className="crm-section-heading"><h2>Scheduled actions</h2><form action={processDueAutomations}><button className="crm-secondary">Process approved due actions</button></form></div>
      {((scheduled ?? []) as ScheduledAction[]).map((action) => <div className="crm-record-row" key={action.id}>
        <span><strong>{action.name}</strong><small>{label(action.status)} · due {new Date(action.due_at).toLocaleString()}</small></span>
        {action.status === "awaiting_approval" && <div className="crm-row-actions">
          <form action={decideScheduledAction}><input type="hidden" name="id" value={action.id} /><button name="approved" value="true">Approve</button></form>
          <form action={decideScheduledAction}><input type="hidden" name="id" value={action.id} /><button name="approved" value="false" className="crm-secondary">Cancel</button></form>
        </div>}
      </div>)}
      {!((scheduled ?? []) as ScheduledAction[]).length && <p>No scheduled actions.</p>}
    </section>
    <section className="crm-panel">
      <div className="crm-section-heading"><h2>Email outbox history</h2><form action={sendQueuedEmails}><button>Send queued emails</button></form></div>
      <p className="crm-muted">This explicit action sends queued messages. Use only approved test recipients during acceptance.</p>
      {communications?.map((item) => <div className="crm-record-row" key={item.id}>
        <span><strong>{item.subject}</strong><small>{item.recipient} · {label(item.template_key)} · {new Date(item.created_at).toLocaleString()}</small></span>
        <span className="crm-chip">{label(item.status)}</span>
      </div>)}
      {!communications?.length && <p>No communications recorded.</p>}
    </section>
  </>;
}
