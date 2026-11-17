import { z } from "zod";
import type { EmailMessage } from "@/lib/email/provider";
import { crmLeadUrl } from "@/lib/email/owner-notification";

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

const optionalText = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((value) => value || null);

export const ownerInquiryNotificationData = z.object({
  lead_id: z.uuid(),
  first_name: z.string().trim().min(1).max(200),
  last_name: optionalText,
  email: z.string().trim().min(3).max(254),
  phone: optionalText,
  preferred_contact_method: optionalText,
  event_type: z.string().trim().min(1).max(200),
  requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guest_count: z.coerce.number().int().min(1).max(10000),
  event_location: optionalText,
  package_interest: optionalText,
});

/**
 * Internal alert to Chef for every new website request
 * (template key `owner_inquiry_notification`). Queued by the 6-argument
 * submit_catering_inquiry only when CHEF_NOTIFICATION_EMAIL is configured.
 * Goes to the owner, never to the customer.
 */
export function renderOwnerInquiryNotification(
  recipient: string,
  idempotencyKey: string,
  input: unknown,
  leadUrl?: string | null,
): EmailMessage {
  const data = ownerInquiryNotificationData.parse(input);
  const link = leadUrl === undefined ? crmLeadUrl(data.lead_id) : leadUrl;
  const date = new Date(`${data.requested_date}T12:00:00Z`).toLocaleDateString(
    "en-US",
    { weekday: "short", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" },
  );
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ");
  const rows: [string, string][] = [
    ["Name", name],
    ["Email", data.email],
    ["Phone", data.phone ?? "Not provided"],
    ["Prefers", data.preferred_contact_method ?? "Not stated"],
    ["Event", `${data.event_type} on ${date}`],
    ["Guests", String(data.guest_count)],
    ["Location", data.event_location ?? "Not provided"],
    ["Package", data.package_interest ?? "Not selected"],
  ];
  const footer =
    "The customer's automatic acknowledgment is queued separately. Nothing is booked until you confirm.";
  return {
    to: recipient,
    subject: `New catering inquiry: ${name} · ${data.event_type} · ${data.guest_count} guests`.slice(0, 300),
    idempotencyKey,
    text: [
      "New catering request from the website.",
      "",
      ...rows.map(([k, v]) => `${k}: ${v}`),
      "",
      link ? `Open the lead in the CRM: ${link}` : "Open the CRM → Leads to review it.",
      "",
      footer,
    ].join("\n"),
    html: `<p>New catering request from the website.</p><table cellpadding="4" style="border-collapse:collapse">${rows
      .map(
        ([k, v]) =>
          `<tr><td style="color:#666;vertical-align:top"><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(v)}</td></tr>`,
      )
      .join("")}</table><p>${
      link
        ? `<a href="${escapeHtml(link)}">Open the lead in the CRM</a>`
        : "Open the CRM → Leads to review it."
    }</p><p style="color:#666">${escapeHtml(footer)}</p>`,
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
  if (templateKey === "owner_inquiry_notification")
    return renderOwnerInquiryNotification(recipient, idempotencyKey, input);
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
