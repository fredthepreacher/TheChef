import type { EmailDelivery, EmailMessage } from "@/lib/email/provider";
import { renderEmailTemplate } from "@/lib/email/templates";

/** A claimed crm_private.email_outbox row (status already set to processing). */
export type OutboxItem = {
  id: string;
  template_key: string;
  recipient_email: string;
  template_data: unknown;
  idempotency_key: string;
};

export type OutboxCompletion = {
  p_outbox_id: string;
  p_success: boolean;
  p_provider_message_id?: string;
  p_error_code?: string;
  p_error_message?: string;
};

export type DeliveryDeps = {
  send: (message: EmailMessage) => Promise<EmailDelivery>;
  complete: (completion: OutboxCompletion) => Promise<void>;
};

export type DeliveryResult = { id: string; status: "submitted" | "failed" };

/**
 * The outbox items a website inquiry queues in its intake transaction: the
 * customer's acknowledgment and (when CHEF_NOTIFICATION_EMAIL is set) Chef's
 * alert. Must match submit_catering_inquiry's idempotency keys.
 */
export function inquiryEmailKeys(requestId: string): string[] {
  return [`inquiry_acknowledgment:${requestId}`, `owner_inquiry_notification:${requestId}`];
}

/**
 * Sends already-claimed outbox items one by one and records each outcome.
 * The outbox idempotency key is passed to the provider, so a retried item can
 * never be delivered twice. A failure is recorded and retried later with
 * backoff by complete_email_outbox; it never throws past one item.
 */
export async function deliverClaimed(items: OutboxItem[], deps: DeliveryDeps): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];
  for (const item of items) {
    try {
      const message = renderEmailTemplate(item.template_key, item.recipient_email, item.idempotency_key, item.template_data);
      const delivery = await deps.send(message);
      await deps.complete({ p_outbox_id: item.id, p_success: true, p_provider_message_id: delivery.providerMessageId });
      results.push({ id: item.id, status: "submitted" });
    } catch (error) {
      await deps.complete({
        p_outbox_id: item.id,
        p_success: false,
        p_error_code: "delivery_failed",
        p_error_message: error instanceof Error ? error.message : "Delivery failed",
      });
      results.push({ id: item.id, status: "failed" });
    }
  }
  return results;
}
