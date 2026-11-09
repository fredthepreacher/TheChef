import { z } from "zod";

/**
 * Chef's new-inquiry alert recipient: server-side configuration only.
 *
 *   CHEF_NOTIFICATION_EMAIL   the owner inbox that receives an alert for every
 *                             new catering request (Vercel env, never in code)
 *
 * Unset → no alert is queued (the customer's inquiry is unaffected). A
 * malformed value is treated as unset and logged without printing it.
 */
const ownerEmail = z.email().max(254);

export function ownerNotificationRecipient(
  value: string | undefined = process.env.CHEF_NOTIFICATION_EMAIL,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = ownerEmail.safeParse(trimmed);
  if (!parsed.success) {
    console.error(
      "CHEF_NOTIFICATION_EMAIL is set but is not a valid email address; Chef inquiry alerts are not being queued.",
    );
    return null;
  }
  return parsed.data.toLowerCase();
}

/** Link to the lead in the CRM, or null when APP_ORIGIN is not a usable origin. */
export function crmLeadUrl(
  leadId: string,
  origin: string | undefined = process.env.APP_ORIGIN,
): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    return `${url.origin}/crm/leads/${encodeURIComponent(leadId)}`;
  } catch {
    return null;
  }
}
