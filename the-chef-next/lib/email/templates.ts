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

const proposalData = z.object({
  first_name: z.string().trim().min(1).max(200),
  quote_number: z.coerce.number().int().positive(),
  proposal_url: z.url().max(2000),
  total_cents: z.coerce.number().int().nonnegative(),
  deposit_required_cents: z.coerce.number().int().nonnegative(),
  expires_at: z.string().nullable().optional(),
});

export function renderCateringProposal(
  recipient: string,
  idempotencyKey: string,
  input: unknown,
): EmailMessage {
  const data = proposalData.parse(input);
  const firstName = escapeHtml(data.first_name);
  const safeUrl = escapeHtml(data.proposal_url);
  const total = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(data.total_cents / 100);
  const deposit = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(data.deposit_required_cents / 100);
  return {
    to: recipient,
    subject: `Your catering proposal #${data.quote_number} from The Chef`,
    idempotencyKey,
    text: `Hi ${data.first_name},\n\nYour catering proposal is ready. Total: ${total}. Required deposit: ${deposit}.\n\nReview it securely: ${data.proposal_url}\n\nThe Chef Catering Services`,
    html: `<p>Hi ${firstName},</p><p>Your catering proposal is ready.</p><p><strong>Total:</strong> ${escapeHtml(total)}<br><strong>Required deposit:</strong> ${escapeHtml(deposit)}</p><p><a href="${safeUrl}">Review your secure proposal</a></p><p>The Chef Catering Services</p>`,
  };
}

export function renderEmailTemplate(
  templateKey: string,
  recipient: string,
  idempotencyKey: string,
  input: unknown,
) {
  if (templateKey === "inquiry_acknowledgment")
    return renderInquiryAcknowledgment(recipient, idempotencyKey, input);
  if (templateKey === "catering_proposal")
    return renderCateringProposal(recipient, idempotencyKey, input);
  const lifecycle = z.object({
    first_name: z.string().trim().min(1).max(200),
    event_type: z.string().trim().min(1).max(200),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).parse(input);
  const date = new Date(`${lifecycle.event_date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
  const content: Record<string, { subject: string; text: string }> = {
    draft_quote_follow_up: {
      subject: "A note about your catering proposal",
      text: `We wanted to check whether you have any questions about your catering proposal for ${lifecycle.event_type} on ${date}. Reply to this message and The Chef will follow up personally.`,
    },
    draft_booking_confirmation: {
      subject: "Your catering booking update",
      text: `We received your required deposit for ${lifecycle.event_type} on ${date}. The Chef will confirm the remaining event details with you personally.`,
    },
    draft_upcoming_event_reminder: {
      subject: "Your catering event is coming up",
      text: `Your ${lifecycle.event_type} on ${date} is coming up. The Chef will follow up personally if any final event details are still needed.`,
    },
    draft_thank_you: {
      subject: "Thank you from The Chef",
      text: `Thank you for inviting The Chef to cater your ${lifecycle.event_type}. It was a pleasure serving you and your guests.`,
    },
    draft_review_request: {
      subject: "How was your experience with The Chef?",
      text: `We hope you enjoyed your ${lifecycle.event_type}. We would value your feedback—reply to this message and tell us about your experience.`,
    },
    draft_rebooking_message: {
      subject: "Plan your next event with The Chef",
      text: `Thank you again for choosing The Chef for your ${lifecycle.event_type}. When you are ready to plan another occasion, reply and we will be happy to help.`,
    },
  };
  const selected = content[templateKey];
  if (selected) {
    const firstName = escapeHtml(lifecycle.first_name);
    const safeText = escapeHtml(selected.text);
    return {
      to: recipient,
      subject: selected.subject,
      idempotencyKey,
      text: `Hi ${lifecycle.first_name},\n\n${selected.text}\n\nThe Chef Catering Services`,
      html: `<p>Hi ${firstName},</p><p>${safeText}</p><p>The Chef Catering Services</p>`,
    };
  }
  throw new Error(`Unsupported email template: ${templateKey}`);
}
