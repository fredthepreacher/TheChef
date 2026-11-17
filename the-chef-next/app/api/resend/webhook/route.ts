import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { serviceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const payload = await request.text();
  let event;
  try {
    event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload,
      webhookSecret: secret,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const providerMessageId = "data" in event && event.data && "email_id" in event.data
    ? String(event.data.email_id)
    : "";
  const { error } = await serviceClient().rpc("process_resend_webhook", {
    p_provider_event_id: request.headers.get("svix-id") ?? createHash("sha256").update(payload).digest("hex"),
    p_event_type: event.type,
    p_payload_sha256: createHash("sha256").update(payload).digest("hex"),
    p_provider_message_id: providerMessageId,
  });
  if (error) return NextResponse.json({ error: "Event processing failed" }, { status: 500 });
  return NextResponse.json({ received: true });
}
