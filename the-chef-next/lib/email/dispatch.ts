import "server-only";
import { configuredEmailProvider, emailProviderConfigured } from "@/lib/email/provider";
import { deliverClaimed, inquiryEmailKeys, type DeliveryResult, type OutboxItem } from "@/lib/email/dispatch-core";
import { serviceClient } from "@/lib/supabase/service";

export type DispatchOutcome = { configured: boolean; processed: DeliveryResult[] };

/**
 * Claims and sends outbox items in-process (no HTTP hop, so it also works on
 * protected preview deployments). When the provider is not configured nothing
 * is claimed: items stay queued instead of burning retry attempts.
 */
async function dispatch(claim: (db: ReturnType<typeof serviceClient>) => PromiseLike<{ data: unknown; error: unknown }>): Promise<DispatchOutcome> {
  if (!emailProviderConfigured()) return { configured: false, processed: [] };
  const db = serviceClient();
  const { data, error } = await claim(db);
  if (error) throw new Error("Could not claim email outbox");
  const provider = configuredEmailProvider();
  const processed = await deliverClaimed((data ?? []) as OutboxItem[], {
    send: (message) => provider.send(message),
    complete: async (completion) => {
      const { error: completeError } = await db.rpc("complete_email_outbox", completion);
      if (completeError) console.error("Email outbox completion failed", { outbox_id: completion.p_outbox_id });
    },
  });
  return { configured: true, processed };
}

/** Everything queued (operator "Send queued emails" and the CRON_SECRET endpoint). */
export function dispatchQueuedEmails(limit = 10): Promise<DispatchOutcome> {
  return dispatch((db) => db.rpc("claim_email_outbox", { p_limit: limit }));
}

/** Only one website inquiry's own acknowledgment and Chef alert. */
export function dispatchInquiryEmails(requestId: string): Promise<DispatchOutcome> {
  return dispatch((db) => db.rpc("claim_email_outbox_by_keys", { p_idempotency_keys: inquiryEmailKeys(requestId) }));
}
