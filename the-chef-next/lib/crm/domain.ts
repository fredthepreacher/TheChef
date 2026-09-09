import { z } from "zod";

export const stages = [
  "new_inquiry",
  "contacted",
  "consultation_scheduled",
  "quote_sent",
  "awaiting_decision",
  "awaiting_deposit",
  "booked",
  "pre_event",
  "completed",
  "lost",
  "cancelled",
  "archived",
] as const;
export const packageOptions = [
  "Unsure",
  "Silver",
  "Gold",
  "Platinum",
  "Custom",
] as const;
export const label = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const text = z.string().trim().max(200);
const notes = z.string().trim().max(4000).default("");
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Enter a valid date",
  );
export const inquirySchema = z
  .object({
    request_id: z.uuid(),
    first_name: text.min(1),
    last_name: text.min(1),
    email: z.email().trim().toLowerCase().max(254),
    phone: text.regex(/^[+\d() .-]{7,30}$/),
    preferred_contact_method: z.enum(["email", "phone"]),
    event_type: text.min(1),
    requested_date: date.refine(
      (v) => v >= new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      "Choose a current or future date",
    ),
    requested_start_time: z
      .union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)])
      .default(""),
    guest_count: z.coerce.number().int().min(1).max(10000),
    package_interest: z.enum(packageOptions),
    service_style: z.enum([
      "unsure",
      "drop_off",
      "buffet",
      "plated",
      "private_chef",
      "full_service",
    ]),
    venue_name: text.default(""),
    venue_address: text.default(""),
    coi_required: z.enum(["unknown", "yes", "no"]),
    budget: text.default(""),
    referral_source: text.default(""),
    menu_notes: notes,
    dietary_notes: notes,
    inquiry_notes: notes,
    consent: z.literal(true),
    website: z.string().max(0).default(""),
    turnstile_token: z.string().max(2048).default(""),
  })
  .strict();
export type Inquiry = z.infer<typeof inquirySchema>;
export const stageSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(stages),
    lost_reason: z.string().trim().max(1000).default(""),
  })
  .refine(
    (v) => v.status !== "lost" || v.lost_reason.length > 0,
    "A lost reason is required",
  );
export const eventSchema = z.object({
  id: z.uuid(),
  event_date: date,
  guest_count: z.coerce.number().int().min(1).max(10000),
  status: z.enum([
    "prospective",
    "booked",
    "pre_event",
    "completed",
    "cancelled",
    "archived",
  ]),
  internal_notes: notes,
});
export type Client = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  preferred_contact_method: string;
  notes: string;
  archived: boolean;
  created_at: string;
};
export type Lead = {
  id: string;
  client_id: string;
  status: (typeof stages)[number];
  event_type: string;
  requested_date: string;
  guest_count: number;
  package_interest: string;
  inquiry: Omit<Inquiry, "turnstile_token" | "website">;
  package_snapshot: Record<string, unknown>;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
  clients: Client;
};
export type CateringEvent = {
  id: string;
  lead_id: string;
  client_id: string;
  event_date: string;
  guest_count: number;
  status: string;
  event_type: string;
  internal_notes: string;
  package_snapshot: Record<string, unknown>;
  menu_snapshot: Record<string, unknown>;
  created_at: string;
  clients: Client;
};
