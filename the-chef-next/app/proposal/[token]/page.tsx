import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createHash } from "node:crypto";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase/service";
import { privacyFingerprint } from "@/lib/security/fingerprint";
import { headers } from "next/headers";
import { money } from "@/lib/crm/domain";
import { acceptProposal, respondToProposal } from "./actions";
import "@/app/crm/crm.css";

export const metadata: Metadata = {
  title: "Catering proposal",
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = "force-dynamic";

type Proposal = {
  quote_number: number;
  version: number;
  status: string;
  title: string;
  introduction: string;
  client_notes: string;
  currency: "USD";
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  service_charge_cents: number;
  gratuity_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  deposit_required_cents: number;
  expires_at: string | null;
  client: { first_name: string; last_name: string };
  event: { event_type: string; requested_date: string; guest_count: number };
  agreement_terms: string;
  line_items: Array<{ description: string; details: string; quantity_milli: number; unit_price_cents: number; line_total_cents: number }>;
};

export default async function ProposalPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; accepted?: string; responded?: string }>;
}) {
  const { token } = await params;
  if (!z.string().regex(/^[A-Za-z0-9_-]{43}$/).safeParse(token).success) notFound();
  const db = serviceClient();
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const { data, error } = await db.rpc("get_proposal_by_token", {
    p_token_sha256: createHash("sha256").update(token).digest("hex"),
    p_network_hash: privacyFingerprint(forwarded || "unavailable"),
  });
  if (error || !data) notFound();
  const proposal = data as Proposal;
  const p = await searchParams;
  const final = ["approved", "declined", "expired", "superseded"].includes(proposal.status);
  return <main className="inquiry-root">
    <div className="inquiry-wrap">
      <p className="crm-eyebrow">The Chef · Catering proposal #{proposal.quote_number}</p>
      <h1>{proposal.title}</h1>
      {p.error && <p className="crm-notice" role="alert">This proposal could not be updated. Please refresh the page or contact The Chef.</p>}
      {p.accepted && <p className="crm-notice" role="status">Thank you. Your electronic acceptance has been recorded. The Chef will follow up with deposit instructions.</p>}
      {p.responded && <p className="crm-notice" role="status">Your response has been recorded. The Chef will follow up with you.</p>}
      <section className="crm-panel">
        <h2>{proposal.client.first_name} {proposal.client.last_name}</h2>
        <p>{proposal.event.event_type} · {proposal.event.requested_date} · {proposal.event.guest_count} guests</p>
        {proposal.introduction && <p className="crm-prewrap">{proposal.introduction}</p>}
      </section>
      <section className="crm-panel">
        <h2>Investment</h2>
        {proposal.line_items.map((item, index) => <div className="crm-record-row" key={`${item.description}-${index}`}>
          <span><strong>{item.description}</strong>{item.details && <small>{item.details}</small>}<small>{item.quantity_milli / 1000} × {money(item.unit_price_cents)}</small></span>
          <strong>{money(item.line_total_cents)}</strong>
        </div>)}
        <dl className="crm-totals">
          <div><dt>Subtotal</dt><dd>{money(proposal.subtotal_cents)}</dd></div>
          {proposal.discount_cents > 0 && <div><dt>Discount</dt><dd>−{money(proposal.discount_cents)}</dd></div>}
          <div><dt>Tax</dt><dd>{money(proposal.tax_cents)}</dd></div>
          <div><dt>Service charge</dt><dd>{money(proposal.service_charge_cents)}</dd></div>
          {proposal.delivery_fee_cents > 0 && <div><dt>Delivery</dt><dd>{money(proposal.delivery_fee_cents)}</dd></div>}
          {proposal.gratuity_cents > 0 && <div><dt>Gratuity</dt><dd>{money(proposal.gratuity_cents)}</dd></div>}
          <div><dt>Total</dt><dd><strong>{money(proposal.total_cents)}</strong></dd></div>
          <div><dt>Deposit required</dt><dd><strong>{money(proposal.deposit_required_cents)}</strong></dd></div>
        </dl>
        {proposal.client_notes && <p className="crm-prewrap">{proposal.client_notes}</p>}
        {proposal.expires_at && <p className="crm-muted">Valid through {new Date(proposal.expires_at).toLocaleDateString("en-US")}.</p>}
      </section>
      <section className="crm-panel">
        <h2>Catering service agreement</h2>
        <div className="crm-agreement">{proposal.agreement_terms}</div>
        <p className="crm-muted">Acceptance records electronic acceptance evidence. It is not a third-party certified e-signature service.</p>
        {!final && <form action={acceptProposal}>
          <input type="hidden" name="token" value={token} />
          <label>Full legal name<input name="typed_name" minLength={2} maxLength={200} required autoComplete="name" /></label>
          <label className="inquiry-check"><input type="checkbox" name="consent" value="true" required /> I have reviewed this proposal and agreement and agree to accept them electronically.</label>
          <button>Accept proposal and agreement</button>
        </form>}
      </section>
      {!final && <section className="crm-panel">
        <h2>Need a change?</h2>
        <form action={respondToProposal}>
          <input type="hidden" name="token" value={token} />
          <label>Message<textarea name="message" maxLength={4000} /></label>
          <div className="crm-row-actions">
            <button name="response" value="revision_requested" className="crm-secondary">Request revision</button>
            <button name="response" value="declined" className="crm-secondary">Decline proposal</button>
          </div>
        </form>
      </section>}
    </div>
  </main>;
}
