import { NextResponse } from "next/server";
import { configuredEmailProvider } from "@/lib/email/provider";
import { renderEmailTemplate } from "@/lib/email/templates";
import { serviceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type OutboxItem = {
  id: string;
  template_key: string;
  recipient_email: string;
  template_data: unknown;
  idempotency_key: string;
};

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = serviceClient();
  const { data, error } = await db.rpc("claim_email_outbox", { p_limit: 10 });
  if (error) return NextResponse.json({ error: "Could not claim outbox" }, { status: 500 });
  const items = (data ?? []) as OutboxItem[];
  let provider;
  try {
    provider = configuredEmailProvider();
  } catch {
    for (const item of items)
      await db.rpc("complete_email_outbox", {
        p_outbox_id: item.id,
        p_success: false,
        p_error_code: "provider_not_configured",
        p_error_message: "Transactional email provider is not configured",
      });
    return NextResponse.json({ error: "Email provider not configured", claimed: items.length }, { status: 503 });
  }
  const results = [];
  for (const item of items) {
    try {
      const message = renderEmailTemplate(item.template_key, item.recipient_email, item.idempotency_key, item.template_data);
      const delivery = await provider.send(message);
      await db.rpc("complete_email_outbox", {
        p_outbox_id: item.id,
        p_success: true,
        p_provider_message_id: delivery.providerMessageId,
      });
      results.push({ id: item.id, status: "submitted" });
    } catch (deliveryError) {
      await db.rpc("complete_email_outbox", {
        p_outbox_id: item.id,
        p_success: false,
        p_error_code: "delivery_failed",
        p_error_message: deliveryError instanceof Error ? deliveryError.message : "Delivery failed",
      });
      results.push({ id: item.id, status: "failed" });
    }
  }
  return NextResponse.json({ processed: results });
}
