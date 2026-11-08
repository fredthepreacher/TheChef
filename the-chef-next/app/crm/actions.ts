"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { generateText } from "ai";
import { configured, serverClient } from "@/lib/supabase/server";
import { stripeClient } from "@/lib/payments/stripe";
import { serviceClient } from "@/lib/supabase/service";
import { requireOperator } from "@/lib/auth/require-operator";
import {
  stageSchema,
  eventSchema,
  eventOperationsSchema,
  eventMenuSchema,
  taskSchema,
  venueSchema,
  createQuoteSchema,
  quoteSettingsSchema,
  quoteLineItemSchema,
  proposalIssueSchema,
  manualPaymentSchema,
} from "@/lib/crm/domain";
export async function login(form: FormData) {
  if (!configured()) redirect("/crm/login?error=setup");
  const parsed = z
    .object({ email: z.email().max(254), password: z.string().min(1).max(200) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/login?error=login");
  const db = await serverClient();
  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error) redirect("/crm/login?error=login");
  await requireOperator();
  redirect("/crm");
}
export async function logout() {
  if (configured()) {
    const db = await serverClient();
    await db.auth.signOut();
  }
  redirect("/crm/login");
}
export async function updateStage(form: FormData) {
  const { db } = await requireOperator();
  const parsed = stageSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/leads?error=validation");
  const { id, status, lost_reason } = parsed.data;
  const { data, error } = await db
    .from("leads")
    .update({ status, lost_reason: status === "lost" ? lost_reason : null })
    .eq("id", id)
    .select("id")
    .single();
  if (error || !data) redirect(`/crm/leads/${id}?error=save`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/leads/${id}?saved=1`);
}
export async function convertLead(form: FormData) {
  const { db } = await requireOperator();
  const parsed = z.uuid().safeParse(form.get("id"));
  if (!parsed.success) redirect("/crm/leads?error=validation");
  const id = parsed.data;
  const { data: existing } = await db
    .from("events")
    .select("id")
    .eq("lead_id", id)
    .maybeSingle();
  if (existing) redirect(`/crm/events/${existing.id}`);
  const { data: lead, error: readError } = await db
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();
  if (readError || !lead) redirect("/crm/leads?error=missing");
  const { data: event, error } = await db
    .from("events")
    .insert({
      lead_id: id,
      client_id: lead.client_id,
      event_type: lead.event_type,
      event_date: lead.requested_date,
      guest_count: lead.guest_count,
      package_snapshot: lead.package_snapshot,
      menu_snapshot: {},
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const { data: duplicate } = await db
      .from("events")
      .select("id")
      .eq("lead_id", id)
      .single();
    if (duplicate) redirect(`/crm/events/${duplicate.id}`);
  }
  if (error || !event) redirect(`/crm/leads/${id}?error=conversion`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/events/${event.id}`);
}
export async function updateEvent(form: FormData) {
  const { db } = await requireOperator();
  const parsed = eventSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/events?error=validation");
  const { id, ...changes } = parsed.data;
  const { data, error } = await db
    .from("events")
    .update(changes)
    .eq("id", id)
    .select("id")
    .single();
  if (error || !data) redirect(`/crm/events/${id}?error=save`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/events/${id}?saved=1`);
}
export async function updateClient(form: FormData) {
  const { db } = await requireOperator();
  const parsed = z
    .object({
      id: z.uuid(),
      notes: z.string().trim().max(4000),
      archived: z.enum(["true", "false"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/clients?error=validation");
  const { id, notes, archived } = parsed.data;
  const { data, error } = await db
    .from("clients")
    .update({ notes, archived: archived === "true" })
    .eq("id", id)
    .select("id")
    .single();
  if (error || !data) redirect(`/crm/clients/${id}?error=save`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/clients/${id}?saved=1`);
}

const dollarsToCents = (value: FormDataEntryValue | null) => {
  const normalized = String(value ?? "").trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Math.round(Number(normalized) * 100);
};
const percentToBps = (value: FormDataEntryValue | null) => {
  const normalized = String(value ?? "").trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Math.round(Number(normalized) * 100);
};

export async function createQuote(form: FormData) {
  const { db } = await requireOperator();
  const parsed = createQuoteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/leads?error=validation");
  const { data, error } = await db.rpc("create_quote_for_lead", {
    p_lead_id: parsed.data.lead_id,
  });
  if (error || !data)
    redirect(`/crm/leads/${parsed.data.lead_id}?error=quote`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/quotes/${data}`);
}

export async function updateQuoteSettings(form: FormData) {
  const { db } = await requireOperator();
  const parsed = quoteSettingsSchema.safeParse({
    ...Object.fromEntries(form),
    discount_cents: dollarsToCents(form.get("discount_dollars")),
    tax_rate_bps: percentToBps(form.get("tax_rate_percent")),
    service_charge_rate_bps: percentToBps(
      form.get("service_charge_rate_percent"),
    ),
    gratuity_cents: dollarsToCents(form.get("gratuity_dollars")),
    delivery_fee_cents: dollarsToCents(form.get("delivery_fee_dollars")),
    deposit_value:
      form.get("deposit_type") === "percentage"
        ? percentToBps(form.get("deposit_value_display"))
        : dollarsToCents(form.get("deposit_value_display")),
  });
  const fallback = String(form.get("quote_id") ?? "");
  if (!parsed.success) redirect(`/crm/quotes/${fallback}?error=validation`);
  const { quote_id, id, ...values } = parsed.data;
  const { error } = await db.from("quote_versions").update(values).eq("id", id);
  if (error) redirect(`/crm/quotes/${quote_id}?error=save`);
  revalidatePath(`/crm/quotes/${quote_id}`);
  redirect(`/crm/quotes/${quote_id}?saved=1`);
}

export async function addQuoteLineItem(form: FormData) {
  const { db } = await requireOperator();
  const parsed = quoteLineItemSchema.safeParse({
    ...Object.fromEntries(form),
    quantity_milli: Math.round(Number(form.get("quantity")) * 1000),
    unit_price_cents: dollarsToCents(form.get("unit_price_dollars")),
  });
  const fallback = String(form.get("quote_id") ?? "");
  if (!parsed.success) redirect(`/crm/quotes/${fallback}?error=line_item`);
  const { quote_id, ...values } = parsed.data;
  const { error } = await db.from("quote_line_items").insert(values);
  if (error) redirect(`/crm/quotes/${quote_id}?error=line_item`);
  revalidatePath(`/crm/quotes/${quote_id}`);
  redirect(`/crm/quotes/${quote_id}?saved=1#pricing`);
}

export async function issueProposal(form: FormData) {
  const { db } = await requireOperator();
  const parsed = proposalIssueSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    redirect(`/crm/quotes/${String(form.get("quote_id") ?? "")}?error=agreement`);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const snapshot = {
    evidence_type: "electronic_acceptance",
    terms: parsed.data.agreement_terms,
    quote_version_id: parsed.data.quote_version_id,
  };
  const contentHash = createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");
  const expiresAt = new Date(Date.now() + 14 * 86400000).toISOString();
  const { error } = await db.rpc("prepare_and_issue_proposal", {
    p_quote_version_id: parsed.data.quote_version_id,
    p_agreement_snapshot: snapshot,
    p_content_sha256: contentHash,
    p_token_sha256: tokenHash,
    p_expires_at: expiresAt,
  });
  if (error) redirect(`/crm/quotes/${parsed.data.quote_id}?error=issue`);
  const proposalPath = `/proposal/${token}`;
  if (parsed.data.queue_email) {
    const origin = process.env.APP_ORIGIN;
    if (!origin) redirect(`/crm/quotes/${parsed.data.quote_id}?error=email_setup`);
    const { error: queueError } = await db.rpc("enqueue_proposal_email", {
      p_quote_version_id: parsed.data.quote_version_id,
      p_token_sha256: tokenHash,
      p_proposal_url: `${origin}${proposalPath}`,
      p_idempotency_key: `catering_proposal:${parsed.data.quote_version_id}`,
    });
    if (queueError) redirect(`/crm/quotes/${parsed.data.quote_id}?error=email_queue`);
  }
  revalidatePath("/crm", "layout");
  redirect(
    `/crm/quotes/${parsed.data.quote_id}?issued=1&proposal=${encodeURIComponent(proposalPath)}`,
  );
}

export async function createQuoteRevision(form: FormData) {
  const { db } = await requireOperator();
  const parsed = z.object({ quote_id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/quotes?error=validation");
  const { error } = await db.rpc("create_quote_revision", { p_quote_id: parsed.data.quote_id });
  if (error) redirect(`/crm/quotes/${parsed.data.quote_id}?error=revision`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/quotes/${parsed.data.quote_id}?saved=1`);
}

export async function revokeProposal(form: FormData) {
  const { db } = await requireOperator();
  const parsed = z.object({ quote_id: z.uuid(), quote_version_id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/quotes?error=validation");
  const { error } = await db.rpc("revoke_proposal_access", { p_quote_version_id: parsed.data.quote_version_id });
  if (error) redirect(`/crm/quotes/${parsed.data.quote_id}?error=revoke`);
  revalidatePath(`/crm/quotes/${parsed.data.quote_id}`);
  redirect(`/crm/quotes/${parsed.data.quote_id}?saved=1`);
}

export async function recordManualPayment(form: FormData) {
  const { db, user } = await requireOperator();
  const parsed = manualPaymentSchema.safeParse({
    ...Object.fromEntries(form),
    amount_cents: dollarsToCents(form.get("amount_dollars")),
  });
  const fallback = String(form.get("event_id") ?? "");
  if (!parsed.success) redirect(`/crm/events/${fallback}?error=payment`);
  const { event_id, ...values } = parsed.data;
  const signedAmount =
    values.transaction_type === "refund"
      ? -values.amount_cents
      : values.amount_cents;
  const { error } = await db.from("payment_transactions").insert({
    ...values,
    amount_cents: signedAmount,
    source: "manual",
    status: "posted",
    currency: "USD",
    recorded_by: user.id,
    idempotency_key: `manual:${randomUUID()}`,
  });
  if (error) redirect(`/crm/events/${event_id}?error=payment`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/events/${event_id}?saved=1#financials`);
}

export async function createStripeCheckout(form: FormData) {
  const { db } = await requireOperator();
  const parsed = z.object({
    event_id: z.uuid(),
    event_financial_id: z.uuid(),
    purpose: z.enum(["deposit", "balance"]),
  }).safeParse(Object.fromEntries(form));
  const fallback = String(form.get("event_id") ?? "");
  if (!parsed.success) redirect(`/crm/events/${fallback}?error=checkout`);
  const { event_id, event_financial_id, purpose } = parsed.data;
  const { data: existing } = await db.from("payment_requests")
    .select("checkout_url")
    .eq("event_financial_id", event_financial_id)
    .eq("purpose", purpose)
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (existing?.checkout_url)
    redirect(`/crm/events/${event_id}?checkout=${encodeURIComponent(existing.checkout_url)}`);
  const { data: financial, error: readError } = await db.from("event_financials")
    .select("deposit_required_cents,paid_cents,balance_remaining_cents,events(clients(email),event_type)")
    .eq("id", event_financial_id)
    .eq("event_id", event_id)
    .single();
  if (readError || !financial) redirect(`/crm/events/${event_id}?error=checkout`);
  const amount = purpose === "deposit"
    ? Math.max(financial.deposit_required_cents - financial.paid_cents, 0)
    : financial.balance_remaining_cents;
  if (amount <= 0) redirect(`/crm/events/${event_id}?error=checkout`);
  const related = financial.events as unknown as {
    clients: { email: string };
    event_type: string;
  };
  const origin = process.env.APP_ORIGIN;
  if (!origin) redirect(`/crm/events/${event_id}?error=checkout_setup`);
  let stripe;
  try {
    stripe = stripeClient();
  } catch {
    redirect(`/crm/events/${event_id}?error=checkout_setup`);
  }
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: related.clients.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: amount,
        product_data: { name: `The Chef catering ${purpose}` },
      },
    }],
    metadata: { event_financial_id, event_id, purpose },
    payment_intent_data: { metadata: { event_financial_id, event_id, purpose } },
    success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/payment/cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  }, { idempotencyKey: `checkout:${event_financial_id}:${purpose}:${randomUUID()}` });
  if (!session.url) redirect(`/crm/events/${event_id}?error=checkout`);
  const { error } = await db.rpc("create_stripe_payment_request", {
    p_event_financial_id: event_financial_id,
    p_purpose: purpose,
    p_provider_session_id: session.id,
    p_checkout_url: session.url,
    p_expires_at: new Date(session.expires_at * 1000).toISOString(),
  });
  if (error) {
    await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    redirect(`/crm/events/${event_id}?error=checkout`);
  }
  revalidatePath(`/crm/events/${event_id}`);
  redirect(`/crm/events/${event_id}?checkout=${encodeURIComponent(session.url)}`);
}

const aiGenerationTypes = [
  "event_summary",
  "draft_inquiry_response",
  "draft_quote_follow_up",
  "draft_booking_confirmation",
  "draft_thank_you",
  "missing_information",
  "next_actions",
] as const;

export async function generateOperatorAssistance(form: FormData) {
  const { db, user } = await requireOperator();
  const parsed = z.object({
    event_id: z.uuid(),
    generation_type: z.enum(aiGenerationTypes),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/assistant?error=validation");
  const model = process.env.AI_GATEWAY_MODEL;
  if (!model || !/^[a-z0-9-]+\/[a-z0-9._-]+$/i.test(model))
    redirect(`/crm/assistant?event=${parsed.data.event_id}&error=ai_setup`);
  const { data: event, error } = await db.from("events")
    .select("event_type,event_date,guest_count,status,service_style,coi_status,venue_requirements,clients(first_name,last_name),leads(status,package_interest,inquiry),event_menus(status,dietary_accommodations,allergy_notes,custom_menu_notes),tasks(title,status,due_at)")
    .eq("id", parsed.data.event_id)
    .single();
  if (error || !event) redirect("/crm/assistant?error=missing");
  const safeContext = JSON.stringify(event);
  const system = `You assist a catering CRM operator. Produce only the requested draft or analysis. Never change or invent prices, discounts, contract terms, payment status, refunds, quote approval, booking status, menu approval, or COI approval. Never claim a date is booked. Clearly mark missing facts and keep customer-facing drafts professional and concise. The operator must review every output before use.`;
  let result;
  try {
    result = await generateText({
      model,
      system,
      prompt: `Task: ${parsed.data.generation_type.replaceAll("_", " ")}\nCatering event context: ${safeContext}`,
      maxOutputTokens: 800,
      providerOptions: {
        gateway: {
          user: user.id,
          tags: ["feature:catering-crm-assistant", `task:${parsed.data.generation_type}`],
        },
      },
    });
  } catch {
    redirect(`/crm/assistant?event=${parsed.data.event_id}&error=ai_request`);
  }
  const { data: saved, error: saveError } = await db.from("ai_generations").insert({
    event_id: parsed.data.event_id,
    generation_type: parsed.data.generation_type,
    model,
    input_sha256: createHash("sha256").update(safeContext).digest("hex"),
    output_text: result.text,
    input_tokens: result.usage.inputTokens ?? null,
    output_tokens: result.usage.outputTokens ?? null,
    created_by: user.id,
  }).select("id").single();
  if (saveError || !saved) redirect(`/crm/assistant?event=${parsed.data.event_id}&error=save`);
  revalidatePath("/crm/assistant");
  redirect(`/crm/assistant?event=${parsed.data.event_id}&generation=${saved.id}`);
}

export async function updateAutomationRule(form: FormData) {
  const { db } = await requireOperator();
  const parsed = z.object({ id: z.uuid(), active: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/communications?error=validation");
  const { error } = await db.from("automation_rules").update({ active: parsed.data.active === "true" }).eq("id", parsed.data.id);
  if (error) redirect("/crm/communications?error=automation");
  revalidatePath("/crm/communications");
  redirect("/crm/communications?saved=1");
}

export async function decideScheduledAction(form: FormData) {
  const { db } = await requireOperator();
  const parsed = z.object({ id: z.uuid(), approved: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/communications?error=validation");
  const { error } = await db.rpc("approve_scheduled_action", { p_action_id: parsed.data.id, p_approved: parsed.data.approved === "true" });
  if (error) redirect("/crm/communications?error=automation");
  revalidatePath("/crm/communications");
  redirect("/crm/communications?saved=1");
}

export async function processDueAutomations() {
  await requireOperator();
  const { error } = await serviceClient().rpc("process_due_scheduled_actions", { p_limit: 20 });
  if (error) redirect("/crm/communications?error=automation");
  revalidatePath("/crm/communications");
  redirect("/crm/communications?processed=1");
}

export async function sendQueuedEmails() {
  await requireOperator();
  const origin = process.env.APP_ORIGIN;
  const secret = process.env.CRON_SECRET;
  if (!origin || !secret) redirect("/crm/communications?error=email_setup");
  const response = await fetch(`${origin}/api/internal/email/dispatch`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  if (!response.ok) redirect("/crm/communications?error=email_delivery");
  revalidatePath("/crm/communications");
  redirect("/crm/communications?sent=1");
}

export async function saveVenue(form: FormData) {
  const { db } = await requireOperator();
  const parsed = venueSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/venues?error=validation");
  const { id, ...values } = parsed.data;
  if (id) {
    const { error } = await db.from("venues").update(values).eq("id", id);
    if (error) redirect(`/crm/venues/${id}?error=save`);
    revalidatePath("/crm", "layout");
    redirect(`/crm/venues/${id}?saved=1`);
  }
  const { data, error } = await db
    .from("venues")
    .insert(values)
    .select("id")
    .single();
  if (error || !data) redirect("/crm/venues?error=save");
  revalidatePath("/crm", "layout");
  redirect(`/crm/venues/${data.id}?saved=1`);
}

export async function updateEventOperations(form: FormData) {
  const { db } = await requireOperator();
  const parsed = eventOperationsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/events?error=validation");
  const { id, ...values } = parsed.data;
  const { error } = await db.from("events").update(values).eq("id", id);
  if (error) redirect(`/crm/events/${id}?error=save`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/events/${id}?saved=1#venue-coi`);
}

export async function setEventConfirmation(form: FormData) {
  const { db } = await requireOperator();
  const parsed = z
    .object({
      id: z.uuid(),
      field: z.enum(["guest_count_confirmed_at", "client_confirmed_at"]),
      confirmed: z.enum(["true", "false"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/events?error=validation");
  const { id, field, confirmed } = parsed.data;
  const { error } = await db
    .from("events")
    .update({ [field]: confirmed === "true" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) redirect(`/crm/events/${id}?error=save`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/events/${id}?saved=1`);
}

export async function updateEventMenu(form: FormData) {
  const { db } = await requireOperator();
  const parsed = eventMenuSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/events?error=validation");
  const { id, event_id, ...values } = parsed.data;
  const { error } = await db.from("event_menus").update(values).eq("id", id);
  if (error) redirect(`/crm/events/${event_id}?error=menu`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/events/${event_id}?saved=1#menu`);
}

export async function createMenuRevision(form: FormData) {
  const { db, user } = await requireOperator();
  const parsed = z
    .object({ event_id: z.uuid(), menu_id: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/events?error=validation");
  const { event_id, menu_id } = parsed.data;
  const { data: current, error: readError } = await db
    .from("event_menus")
    .select("*")
    .eq("id", menu_id)
    .eq("event_id", event_id)
    .single();
  if (readError || !current) redirect(`/crm/events/${event_id}?error=menu`);
  const {
    id: _id,
    created_at: _created,
    updated_at: _updated,
    approved_at: _approved,
    locked_at: _locked,
    created_by: _creator,
    ...copy
  } = current;
  void [_id, _created, _updated, _approved, _locked, _creator];
  const { data: revision, error } = await db
    .from("event_menus")
    .insert({
      ...copy,
      version: current.version + 1,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !revision) redirect(`/crm/events/${event_id}?error=menu`);
  const { error: linkError } = await db
    .from("events")
    .update({ current_menu_id: revision.id })
    .eq("id", event_id);
  if (linkError) redirect(`/crm/events/${event_id}?error=menu`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/events/${event_id}?saved=1#menu`);
}

export async function saveTask(form: FormData) {
  const { db, user } = await requireOperator();
  const parsed = taskSchema.safeParse(Object.fromEntries(form));
  const fallback = String(form.get("event_id") || "");
  if (!parsed.success)
    redirect(fallback ? `/crm/events/${fallback}?error=task` : "/crm/tasks?error=validation");
  const { id, ...values } = parsed.data;
  const destination = values.event_id
    ? `/crm/events/${values.event_id}`
    : "/crm/tasks";
  if (id) {
    const { error } = await db.from("tasks").update(values).eq("id", id);
    if (error) redirect(`${destination}?error=task`);
  } else {
    if (!values.event_id) redirect("/crm/tasks?error=validation");
    const { error } = await db
      .from("tasks")
      .insert({ ...values, created_by: user.id });
    if (error) redirect(`${destination}?error=task`);
  }
  revalidatePath("/crm", "layout");
  redirect(`${destination}?saved=1${values.event_id ? "#tasks" : ""}`);
}
