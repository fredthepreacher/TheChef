import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripeClient, stripeWebhookSecret } from "@/lib/payments/stripe";
import { serviceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(
      payload,
      signature,
      stripeWebhookSecret(),
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (!["checkout.session.completed", "checkout.session.expired"].includes(event.type))
    return NextResponse.json({ received: true });
  const session = event.data.object as Stripe.Checkout.Session;
  const db = serviceClient();
  const { error } = await db.rpc("process_stripe_checkout_event", {
    p_provider_event_id: event.id,
    p_event_type: event.type,
    p_payload_sha256: createHash("sha256").update(payload).digest("hex"),
    p_provider_session_id: session.id,
    p_provider_payment_id:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
    p_paid: session.payment_status === "paid",
    p_amount_total: session.amount_total,
    p_currency: session.currency,
  });
  if (error)
    return NextResponse.json({ error: "Event processing failed" }, { status: 500 });
  return NextResponse.json({ received: true });
}
