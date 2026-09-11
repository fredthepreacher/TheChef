import { z } from "zod";
import type { EmailMessage } from "@/lib/email/provider";

export const inquiryAcknowledgmentData = z.object({
  first_name: z.string().trim().min(1).max(200),
  event_type: z.string().trim().min(1).max(200),
  requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guest_count: z.coerce.number().int().min(1).max(10000),
  package_interest: z.string().trim().min(1).max(200),
});

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export function renderInquiryAcknowledgment(
  recipient: string,
  idempotencyKey: string,
  input: unknown,
): EmailMessage {
  const data = inquiryAcknowledgmentData.parse(input);
  const date = new Date(`${data.requested_date}T12:00:00Z`).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" },
  );
  const summary = `${data.event_type} on ${date} for ${data.guest_count} guests · ${data.package_interest} package`;
  const firstName = escapeHtml(data.first_name);
  const safeSummary = escapeHtml(summary);
  return {
    to: recipient,
    subject: "We received your catering inquiry",
    idempotencyKey,
    text: `Hi ${data.first_name},

Thank you for thinking of The Chef. We received your catering inquiry for ${summary}.

Chef Frankie will review the details and follow up personally. This message confirms receipt only; your date is not booked until availability and event details are confirmed.

The Chef Catering Services`,
    html: `<p>Hi ${firstName},</p><p>Thank you for thinking of <strong>The Chef</strong>. We received your catering inquiry for ${safeSummary}.</p><p>Chef Frankie will review the details and follow up personally. This message confirms receipt only; your date is not booked until availability and event details are confirmed.</p><p>The Chef Catering Services</p>`,
  };
}
