import Link from "next/link";
import { Empty } from "@/components/crm/Shared";
import { requireOperator } from "@/lib/auth/require-operator";
import { label, money } from "@/lib/crm/domain";
import { formatEtDate, formatEtDateTime } from "@/lib/crm/time";

type ClientName = { first_name: string; last_name: string };
type EventSummary = { event_type: string; event_date: string; clients: ClientName };
type Financial = {
  id: string; event_id: string; commercial_status: string;
  deposit_due_at: string | null; balance_due_at: string | null;
  gross_due_cents: number; deposit_required_cents: number;
  paid_cents: number; balance_remaining_cents: number; events: EventSummary;
};
type QuoteVersion = { id: string; status: string; total_cents: number; expires_at: string | null };
type Quote = {
  id: string; quote_number: number; current_version_id: string | null;
  event_id: string | null; events: EventSummary | null;
};
type Payment = {
  id: string; amount_cents: number; occurred_at: string;
  event_financials: { event_id: string; events: EventSummary };
};
type Communication = {
  id: string; event_id: string | null; subject: string; recipient: string;
  status: string; created_at: string;
};
type ScheduledAction = {
  id: string; name: string; entity_type: string; entity_id: string;
  due_at: string; status: string;
};

const cents = (
  rows: Financial[],
  key: keyof Pick<Financial, "gross_due_cents" | "paid_cents" | "balance_remaining_cents">,
) => rows.reduce((sum, row) => sum + row[key], 0);

export default async function RevenuePage() {
  const { db } = await requireOperator();
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 86400000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
  const [financialResult, quotesResult, paymentResult, communicationResult, actionsResult] =
    await Promise.all([
      db.from("event_financials")
        .select("*,events(event_type,event_date,clients(first_name,last_name))")
        .order("updated_at", { ascending: false }),
      db.from("quotes")
        .select("id,quote_number,current_version_id,event_id,events(event_type,event_date,clients(first_name,last_name))")
        .order("updated_at", { ascending: false }),
      db.from("payment_transactions")
        .select("id,amount_cents,occurred_at,event_financials(event_id,events(event_type,event_date,clients(first_name,last_name)))")
        .eq("status", "posted")
        .gte("occurred_at", fourteenDaysAgo.toISOString())
        .order("occurred_at", { ascending: false })
        .limit(12),
      db.from("communications")
        .select("id,event_id,subject,recipient,status,created_at")
        .in("status", ["queued", "failed"])
        .order("created_at")
        .limit(20),
      db.rpc("list_scheduled_actions"),
    ]);
  if (financialResult.error || quotesResult.error || paymentResult.error || communicationResult.error || actionsResult.error)
    throw new Error("Could not load revenue attention data");

  const financials = (financialResult.data ?? []) as unknown as Financial[];
  const quotes = (quotesResult.data ?? []) as unknown as Quote[];
  const currentVersionIds = quotes.map((quote) => quote.current_version_id)
    .filter((id): id is string => Boolean(id));
  const versionsResult = currentVersionIds.length
    ? await db.from("quote_versions").select("id,status,total_cents,expires_at").in("id", currentVersionIds)
    : { data: [], error: null };
  if (versionsResult.error) throw new Error("Could not load current quote versions");
  const versions = (versionsResult.data ?? []) as QuoteVersion[];
  const versionsById = new Map(versions.map((version) => [version.id, version]));
  const quoteAttention = quotes
    .map((quote) => ({ quote, version: quote.current_version_id ? versionsById.get(quote.current_version_id) : undefined }))
    .filter((item): item is { quote: Quote; version: QuoteVersion } => Boolean(item.version));

  const awaitingResponse = quoteAttention.filter(({ version }) => ["sent", "viewed"].includes(version.status));
  const expiring = awaitingResponse.filter(({ version }) => version.expires_at && new Date(version.expires_at) <= sevenDays);
  const awaitingDeposit = financials.filter((row) => row.commercial_status === "approved_deposit_pending");
  const depositsDue = awaitingDeposit.filter((row) => row.deposit_due_at && new Date(row.deposit_due_at) <= now);
  const overdueBalances = financials.filter((row) => row.balance_remaining_cents > 0 && row.balance_due_at && new Date(row.balance_due_at) < now);
  const booked = financials.filter((row) => ["booked", "balance_due", "paid", "completed"].includes(row.commercial_status));
  const payments = (paymentResult.data ?? []) as unknown as Payment[];
  const communications = (communicationResult.data ?? []) as Communication[];
  const actions = ((actionsResult.data ?? []) as ScheduledAction[]).filter((action) =>
    ["pending", "awaiting_approval", "failed"].includes(action.status) && new Date(action.due_at) <= now,
  );
  const quoted = quoteAttention
    .filter(({ version }) => !["draft", "superseded", "declined", "expired"].includes(version.status))
    .reduce((sum, { version }) => sum + version.total_cents, 0);
  const approved = cents(financials, "gross_due_cents");

  return <>
    <p className="crm-eyebrow">What money or follow-up needs attention today?</p>
    <h1>Revenue</h1>
    <div className="crm-kpis">
      <div className="crm-panel"><p>Quoted</p><strong>{money(quoted)}</strong></div>
      <div className="crm-panel"><p>Approved</p><strong>{money(approved)}</strong></div>
      <div className="crm-panel"><p>Collected</p><strong>{money(cents(financials, "paid_cents"))}</strong></div>
      <div className="crm-panel"><p>Outstanding</p><strong>{money(cents(financials, "balance_remaining_cents"))}</strong></div>
      <div className="crm-panel"><p>Booked-event value</p><strong>{money(cents(booked, "gross_due_cents"))}</strong></div>
    </div>

    <div className="crm-columns">
      <section className="crm-panel">
        <h2>Proposal attention</h2>
        <p><strong>{awaitingResponse.length}</strong> awaiting response · <strong>{expiring.length}</strong> expiring within 7 days</p>
        {awaitingResponse.slice(0, 8).map(({ quote, version }) => <Link className="crm-record-row" key={quote.id} href={`/crm/quotes/${quote.id}`}>
          <span><strong>Quote #{quote.quote_number}</strong><small>{quote.events ? `${quote.events.clients.first_name} ${quote.events.clients.last_name} · ${quote.events.event_type}` : label(version.status)}</small></span>
          <span>{money(version.total_cents)} · {version.expires_at ? `expires ${formatEtDate(version.expires_at)}` : "no expiry"}</span>
        </Link>)}
        {!awaitingResponse.length && <Empty>No proposals are awaiting a response.</Empty>}
      </section>
      <section className="crm-panel">
        <h2>Payment attention</h2>
        <p><strong>{awaitingDeposit.length}</strong> awaiting deposit · <strong>{depositsDue.length}</strong> deposits due · <strong>{overdueBalances.length}</strong> overdue balances</p>
        {[...depositsDue, ...overdueBalances.filter((row) => !depositsDue.some((due) => due.id === row.id))].slice(0, 8).map((row) =>
          <Link className="crm-record-row" key={row.id} href={`/crm/events/${row.event_id}#financials`}>
            <span><strong>{row.events.event_type} · {row.events.clients.first_name} {row.events.clients.last_name}</strong><small>{label(row.commercial_status)} · {row.events.event_date}</small></span>
            <span>{money(row.balance_remaining_cents)} due</span>
          </Link>)}
        {!depositsDue.length && !overdueBalances.length && <Empty>No due or overdue payments.</Empty>}
      </section>
    </div>

    <div className="crm-columns">
      <section className="crm-panel">
        <h2>Follow-ups and delivery</h2>
        <p><strong>{actions.length}</strong> follow-ups due · <strong>{communications.length}</strong> queued or failed messages</p>
        {actions.slice(0, 6).map((action) => <p key={action.id}><strong>{action.name}</strong> · {label(action.status)} · {formatEtDateTime(action.due_at)}</p>)}
        {communications.slice(0, 6).map((message) => <p key={message.id}><strong>{label(message.status)}</strong> · {message.subject || "Transactional message"} · {message.recipient}</p>)}
        {!actions.length && !communications.length && <Empty>No customer follow-up needs attention.</Empty>}
        <p><Link href="/crm/communications">Open communications center →</Link></p>
      </section>
      <section className="crm-panel">
        <h2>Recently paid</h2>
        {payments.map((payment) => <Link className="crm-record-row" key={payment.id} href={`/crm/events/${payment.event_financials.event_id}#financials`}>
          <span><strong>{payment.event_financials.events.event_type}</strong><small>{payment.event_financials.events.clients.first_name} {payment.event_financials.events.clients.last_name} · {formatEtDate(payment.occurred_at)}</small></span>
          <span>{money(payment.amount_cents)}</span>
        </Link>)}
        {!payments.length && <Empty>No payments posted in the last 14 days.</Empty>}
      </section>
    </div>

    <section className="crm-panel">
      <h2>All event balances</h2>
      {financials.map((row) => <Link className="crm-record-row" key={row.id} href={`/crm/events/${row.event_id}#financials`}>
        <span><strong>{row.events.event_type} · {row.events.clients.first_name} {row.events.clients.last_name}</strong><small>{row.events.event_date} · {label(row.commercial_status)}</small></span>
        <span>{money(row.paid_cents)} paid · {money(row.balance_remaining_cents)} due</span>
      </Link>)}
      {!financials.length && <Empty>Approved proposals will appear here.</Empty>}
    </section>
  </>;
}
