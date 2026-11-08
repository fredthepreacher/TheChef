import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOperator } from "@/lib/auth/require-operator";
import { addQuoteLineItem, createQuoteRevision, issueProposal, revokeProposal, updateQuoteSettings } from "@/app/crm/actions";
import { Activity, Notice } from "@/components/crm/Shared";
import { label, money, type Client, type QuoteLineItem, type QuoteVersion } from "@/lib/crm/domain";

type QuoteDetail = {
  id: string;
  quote_number: number;
  lead_id: string;
  event_id: string;
  current_version_id: string;
  clients: Client;
  quote_versions: QuoteVersion[];
};

export default async function QuoteDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; issued?: string; proposal?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db } = await requireOperator();
  const { data, error } = await db
    .from("quotes")
    .select("id,quote_number,lead_id,event_id,current_version_id,clients!quotes_client_id_fkey(*),quote_versions!quote_versions_quote_id_fkey(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load quote");
  if (!data) notFound();
  const quote = data as unknown as QuoteDetail;
  const version = quote.quote_versions.find((candidate) => candidate.id === quote.current_version_id);
  if (!version) throw new Error("Quote has no current version");
  const { data: itemData, error: itemError } = await db
    .from("quote_line_items")
    .select("*")
    .eq("quote_version_id", version.id)
    .order("display_order");
  if (itemError) throw new Error("Could not load quote items");
  const items = itemData as QuoteLineItem[];
  const p = await searchParams;
  const editable = version.status === "draft";
  const proposalUrl = p.proposal
    ? `${process.env.APP_ORIGIN ?? ""}${p.proposal}`
    : null;
  return (
    <>
      <Link href="/crm/quotes">← Quotes</Link>
      <p className="crm-eyebrow">Quote #{quote.quote_number} · Version {version.version}</p>
      <h1>{version.title}</h1>
      <Notice error={p.error} saved={p.saved} />
      {p.issued && proposalUrl && (
        <div className="crm-notice" role="status">
          <strong>Proposal issued.</strong>
          <p>This access link is shown once. Send it only to the intended client.</p>
          <input readOnly value={proposalUrl} aria-label="Client proposal link" />
        </div>
      )}
      <p>
        {quote.clients.first_name} {quote.clients.last_name} · <Link href={`/crm/leads/${quote.lead_id}`}>Lead</Link> · <Link href={`/crm/events/${quote.event_id}`}>Event</Link>
      </p>
      <span className="crm-chip">{label(version.status)}</span>
      {!editable && version.status !== "approved" && <div className="crm-row-actions">
        <form action={createQuoteRevision}><input type="hidden" name="quote_id" value={quote.id} /><button className="crm-secondary">Create revision</button></form>
        <form action={revokeProposal}><input type="hidden" name="quote_id" value={quote.id} /><input type="hidden" name="quote_version_id" value={version.id} /><button className="crm-secondary">Revoke client link</button></form>
      </div>}
      <div className="crm-columns">
        <section className="crm-panel" id="pricing">
          <h2>Pricing</h2>
          {items.map((item) => (
            <div className="crm-record-row" key={item.id}>
              <span><strong>{item.description}</strong><small>{item.quantity_milli / 1000} × {money(item.unit_price_cents)}{item.taxable ? " · taxable" : ""}</small></span>
              <strong>{money(item.line_total_cents)}</strong>
            </div>
          ))}
          {!items.length && <p>No line items yet.</p>}
          <dl className="crm-totals">
            <div><dt>Subtotal</dt><dd>{money(version.subtotal_cents)}</dd></div>
            <div><dt>Discount</dt><dd>−{money(version.discount_cents)}</dd></div>
            <div><dt>Tax</dt><dd>{money(version.tax_cents)}</dd></div>
            <div><dt>Service charge</dt><dd>{money(version.service_charge_cents)}</dd></div>
            <div><dt>Delivery</dt><dd>{money(version.delivery_fee_cents)}</dd></div>
            <div><dt>Gratuity</dt><dd>{money(version.gratuity_cents)}</dd></div>
            <div><dt>Total</dt><dd><strong>{money(version.total_cents)}</strong></dd></div>
            <div><dt>Required deposit</dt><dd><strong>{money(version.deposit_required_cents)}</strong></dd></div>
          </dl>
          {editable && (
            <form action={addQuoteLineItem}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <input type="hidden" name="quote_version_id" value={version.id} />
              <input type="hidden" name="display_order" value={items.length} />
              <label>Description<input name="description" required maxLength={500} /></label>
              <label>Details<textarea name="details" maxLength={4000} /></label>
              <div className="crm-form-grid">
                <label>Quantity<input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" required /></label>
                <label>Unit price (USD)<input name="unit_price_dollars" inputMode="decimal" defaultValue="0.00" required /></label>
              </div>
              <input type="hidden" name="taxable" value="false" />
              <label className="crm-inline-check"><input type="checkbox" name="taxable" value="true" defaultChecked /> Taxable</label>
              <button>Add line item</button>
            </form>
          )}
        </section>
        <section className="crm-panel">
          <h2>Proposal settings</h2>
          {editable ? (
            <form action={updateQuoteSettings}>
              <input type="hidden" name="id" value={version.id} />
              <input type="hidden" name="quote_id" value={quote.id} />
              <label>Title<input name="title" defaultValue={version.title} required /></label>
              <label>Introduction<textarea name="introduction" defaultValue={version.introduction} /></label>
              <label>Client notes<textarea name="client_notes" defaultValue={version.client_notes} /></label>
              <label>Internal notes<textarea name="internal_notes" defaultValue={version.internal_notes} /></label>
              <div className="crm-form-grid">
                <label>Discount (USD)<input name="discount_dollars" defaultValue={(version.discount_cents / 100).toFixed(2)} /></label>
                <label>Tax rate (%)<input name="tax_rate_percent" defaultValue={(version.tax_rate_bps / 100).toFixed(2)} /></label>
                <label>Service charge (%)<input name="service_charge_rate_percent" defaultValue={(version.service_charge_rate_bps / 100).toFixed(2)} /></label>
                <label>Delivery fee (USD)<input name="delivery_fee_dollars" defaultValue={(version.delivery_fee_cents / 100).toFixed(2)} /></label>
                <label>Gratuity (USD)<input name="gratuity_dollars" defaultValue={(version.gratuity_cents / 100).toFixed(2)} /></label>
                <label>Deposit method<select name="deposit_type" defaultValue={version.deposit_type}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select></label>
                <label>Deposit value ({version.deposit_type === "percentage" ? "%" : "USD"})<input name="deposit_value_display" defaultValue={version.deposit_type === "percentage" ? (version.deposit_value / 100).toFixed(2) : (version.deposit_value / 100).toFixed(2)} /></label>
                <label>Expires<input name="expires_at" type="datetime-local" defaultValue={version.expires_at?.slice(0, 16) ?? ""} /></label>
              </div>
              <button>Save proposal</button>
            </form>
          ) : <p>Issued versions are locked. Create a revision to change pricing or terms.</p>}
        </section>
      </div>
      {editable && (
        <section className="crm-panel">
          <h2>Agreement and client access</h2>
          <p className="crm-muted">The client records electronic acceptance evidence with a typed name and explicit consent. This is not a third-party certified e-signature.</p>
          <form action={issueProposal}>
            <input type="hidden" name="quote_id" value={quote.id} />
            <input type="hidden" name="quote_version_id" value={version.id} />
            <label>Agreement terms<textarea name="agreement_terms" minLength={20} maxLength={50000} required /></label>
            <input type="hidden" name="queue_email" value="false" />
            <label className="crm-inline-check"><input type="checkbox" name="queue_email" value="true" /> Queue the proposal email after issuing</label>
            <button disabled={!items.length || version.total_cents <= 0}>Lock and issue proposal</button>
          </form>
        </section>
      )}
      <Activity id={quote.id} relatedIds={[version.id]} />
    </>
  );
}
