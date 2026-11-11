import { z } from "zod";
import {
  MAX_MENU_SELECTIONS,
  catalogKeys,
  groupSelection,
} from "@/lib/catering/menu-catalog";
import { THANKSGIVING, feastById, type Feast } from "@/data/thanksgiving";
import { etInputToIso } from "@/lib/crm/time";

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
  // Seasonal (data/thanksgiving.ts). leads.package_interest is free text in
  // the database, so new values need no migration.
  "Thanksgiving Intimate Feast",
  "Thanksgiving Family Feast",
  "Thanksgiving Gathering Feast",
  "Thanksgiving Grand Feast",
] as const;
// Compile-time guard: every feast maps to a real package option.
const _feastPackagesAreOptions: readonly (typeof packageOptions)[number][] =
  THANKSGIVING.feasts.map((f: Feast) => f.packageInterest);
void _feastPackagesAreOptions;
export const coiStatuses = [
  "not_required",
  "requirement_unknown",
  "required",
  "requested",
  "received",
  "submitted_to_venue",
  "approved",
  "rejected_needs_revision",
] as const;
export const menuStatuses = [
  "draft",
  "client_review",
  "revision_requested",
  "approved",
  "locked",
] as const;
export const taskCategories = [
  "food_prep",
  "purchasing",
  "equipment",
  "staffing",
  "venue",
  "insurance",
  "client",
  "transport",
  "setup",
  "administrative",
] as const;
export const taskStatuses = [
  "todo",
  "in_progress",
  "blocked",
  "complete",
] as const;
export const taskPriorities = ["low", "normal", "high", "urgent"] as const;
export const documentCategories = [
  "coi",
  "contract",
  "venue_requirements",
  "menu",
  "floor_plan",
  "event_instructions",
  "other",
] as const;
export const quoteStatuses = [
  "draft",
  "ready_for_review",
  "sent",
  "viewed",
  "revision_requested",
  "approved",
  "declined",
  "expired",
  "superseded",
] as const;
/** Quote-version states in which the client can still accept, ask for changes or decline. */
export const PROPOSAL_OPEN_STATUSES: readonly string[] = ["sent", "viewed"];
/** What the client proposal page says when a proposal no longer takes a response. */
export function proposalClosedNotice(status: string): string {
  switch (status) {
    case "approved":
      return "You accepted this proposal. The Chef will follow up with deposit instructions.";
    case "revision_requested":
      return "You asked for changes. The Chef is preparing a revised proposal and will send you a new link.";
    case "declined":
      return "You declined this proposal. Contact The Chef if you would like a new one.";
    case "expired":
      return "This proposal has expired. Contact The Chef for an updated proposal.";
    default:
      return "This proposal is no longer open for a response. Contact The Chef with any questions.";
  }
}
export const label = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const text = z.string().trim().max(200);
/** Guest menu notes are capped so notes + the folded selection list always fit
 *  the 4000-char event_menus.custom_menu_notes check. */
export const MENU_NOTES_MAX = 1500;
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
/** Thanksgiving order details (data/thanksgiving.ts) — catalog values only. */
export const thanksgivingOrderSchema = z
  .object({
    feast: z.enum(["intimate", "family", "gathering", "grand"]),
    sides: z.array(z.enum(THANKSGIVING.sides)).max(9).default([]),
    pies: z.array(z.enum(THANKSGIVING.pies)).max(6).default([]),
    bread: z.union([z.literal(""), z.enum(THANKSGIVING.breads)]).default(""),
  })
  .strict();

const tag = z.string().trim().max(300);
/**
 * Ad-click / campaign data captured first-party from the landing URL
 * (lib/attribution.ts). Stored in leads.inquiry for offline-conversion
 * uploads later. Never allowed to reject a lead: malformed → dropped.
 */
export const attributionSchema = z.object({
  utm_source: tag.optional(),
  utm_medium: tag.optional(),
  utm_campaign: tag.optional(),
  utm_content: tag.optional(),
  utm_term: tag.optional(),
  gclid: tag.optional(),
  gbraid: tag.optional(),
  wbraid: tag.optional(),
  fbclid: tag.optional(),
  fbc: tag.optional(),
  fbp: tag.optional(),
  landing_path: tag.optional(),
  captured_at: z.string().max(40).optional(),
});

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
    /** City + ZIP of the event — required so Chef can confirm service area. */
    event_location: text.min(2),
    venue_name: text.default(""),
    venue_address: text.default(""),
    coi_required: z.enum(["unknown", "yes", "no"]),
    budget: text.default(""),
    referral_source: text.default(""),
    /** Dishes picked on the website menu ("Category: Item" catalog keys). */
    selected_menu_items: z
      .array(z.string().max(160))
      .max(MAX_MENU_SELECTIONS)
      .default([])
      .refine(
        (items) => items.every((i) => catalogKeys.has(i)),
        "Unknown menu item",
      )
      .refine(
        (items) => new Set(items).size === items.length,
        "Duplicate menu item",
      ),
    menu_notes: z.string().trim().max(MENU_NOTES_MAX).default(""),
    dietary_notes: notes,
    inquiry_notes: notes,
    consent: z.literal(true),
    website: z.string().max(0).default(""),
    turnstile_token: z.string().max(2048).default(""),
    thanksgiving: thanksgivingOrderSchema.optional(),
    attribution: attributionSchema.optional().catch(undefined),
  })
  .strict()
  .superRefine((v, ctx) => {
    const feast = v.thanksgiving && feastById(v.thanksgiving.feast);
    const seasonal = v.package_interest.startsWith("Thanksgiving ");
    if (!v.thanksgiving) {
      if (seasonal)
        ctx.addIssue({ code: "custom", message: "Choose your feast", path: ["thanksgiving"] });
      return;
    }
    if (!feast || feast.packageInterest !== v.package_interest)
      ctx.addIssue({ code: "custom", message: "Feast mismatch", path: ["package_interest"] });
    else {
      const { sides, pies } = v.thanksgiving;
      if (sides.length > feast.sides || new Set(sides).size !== sides.length)
        ctx.addIssue({ code: "custom", message: `Choose up to ${feast.sides} sides`, path: ["thanksgiving", "sides"] });
      if (pies.length > feast.pies || new Set(pies).size !== pies.length)
        ctx.addIssue({ code: "custom", message: `Choose up to ${feast.pies} pies`, path: ["thanksgiving", "pies"] });
    }
    if (v.selected_menu_items.length)
      ctx.addIssue({ code: "custom", message: "Feast orders use the Thanksgiving menu", path: ["selected_menu_items"] });
  });
export type Inquiry = z.infer<typeof inquirySchema>;

/**
 * Fold the website menu selections into `menu_notes` so they travel through
 * the existing (already hosted) pipeline without a migration: lead → event
 * menu_snapshot → event_menus.custom_menu_notes (DB check: ≤ 4000 chars).
 * The structured `selected_menu_items` array is kept alongside for the CRM.
 */
export function composeMenuNotes(selected: readonly string[], guestNotes: string) {
  const lines = groupSelection(selected).map(
    (g) => `${g.category}: ${g.items.map((i) => i.name).join(", ")}`,
  );
  const notes = guestNotes.trim();
  const parts: string[] = [];
  if (lines.length) parts.push(["Selected on website:", ...lines].join("\n"));
  if (notes) parts.push(lines.length ? `Guest notes:\n${notes}` : notes);
  return parts.join("\n\n");
}
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
const optionalUuid = z
  .union([z.literal(""), z.uuid()])
  .transform((value) => value || null);
/**
 * `datetime-local` form values are Eastern wall time (see lib/crm/time.ts);
 * store them as the matching UTC instant. A value that already carries a
 * zone ("Z") is kept as that instant.
 */
const optionalDateTime = z
  .union([z.literal(""), z.iso.datetime({ local: true })])
  .transform((value) =>
    !value ? null : /z$/i.test(value) ? new Date(value).toISOString() : etInputToIso(value),
  );
const optionalTime = z
  .union([
    z.literal(""),
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  ])
  .transform((value) => value || null);
const longNotes = z.string().trim().max(4000).default("");

export const venueSchema = z.object({
  id: optionalUuid,
  name: text.min(1),
  address: z.string().trim().max(500).default(""),
  city: z.string().trim().max(100).default(""),
  state: z.string().trim().max(100).default(""),
  postal_code: z.string().trim().max(20).default(""),
  contact_name: text.default(""),
  contact_email: z
    .union([z.literal(""), z.email().trim().toLowerCase().max(254)])
    .default(""),
  contact_phone: z.string().trim().max(30).default(""),
  loading_instructions: longNotes,
  kitchen_availability: z.enum([
    "unknown",
    "none",
    "limited",
    "full",
    "commercial",
  ]),
  parking_loading_notes: longNotes,
  setup_restrictions: longNotes,
  notes: longNotes,
  coi_requirement: z.enum(["unknown", "not_required", "required"]),
  additional_insured_requirements: longNotes,
  insurance_notes: longNotes,
  insurance_due_days_before_event: z
    .union([z.literal(""), z.coerce.number().int().min(0).max(365)])
    .transform((value) => (value === "" ? null : value)),
});

export const eventOperationsSchema = z
  .object({
    id: z.uuid(),
    venue_id: optionalUuid,
    start_time: optionalTime,
    end_time: optionalTime,
    service_style: z.string().trim().max(200).default(""),
    coi_status: z.enum(coiStatuses),
    coi_due_at: optionalDateTime,
    venue_requirements: longNotes,
    additional_insured_information: longNotes,
    coi_internal_notes: longNotes,
  })
  .refine(
    (value) =>
      !value.start_time ||
      !value.end_time ||
      value.end_time > value.start_time,
    "End time must be after start time",
  );

export const eventMenuSchema = z.object({
  id: z.uuid(),
  event_id: z.uuid(),
  status: z.enum(menuStatuses),
  package_details: longNotes,
  appetizers: longNotes,
  entrees: longNotes,
  seafood: longNotes,
  sides: longNotes,
  desserts: longNotes,
  bread: longNotes,
  dietary_accommodations: longNotes,
  allergy_notes: longNotes,
  substitutions: longNotes,
  custom_menu_notes: longNotes,
  internal_prep_notes: longNotes,
});

export const taskSchema = z.object({
  id: optionalUuid,
  event_id: optionalUuid,
  title: text.min(1),
  description: longNotes,
  category: z.enum(taskCategories),
  assignee_id: optionalUuid,
  due_at: optionalDateTime,
  status: z.enum(taskStatuses),
  priority: z.enum(taskPriorities),
  required: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true"),
  notes: longNotes,
});

export const documentMetadataSchema = z.object({
  event_id: z.uuid(),
  category: z.enum(documentCategories),
  storage_path: z.string().trim().min(1).max(1000),
  original_filename: z.string().trim().min(1).max(255),
  mime_type: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  size_bytes: z.coerce.number().int().min(1).max(10485760),
  replaces_document_id: optionalUuid,
  notes: longNotes,
});
export const createQuoteSchema = z.object({
  lead_id: z.uuid(),
});
export const quoteSettingsSchema = z.object({
  id: z.uuid(),
  quote_id: z.uuid(),
  title: text.min(1),
  introduction: z.string().trim().max(8000).default(""),
  client_notes: z.string().trim().max(8000).default(""),
  internal_notes: z.string().trim().max(8000).default(""),
  discount_cents: z.coerce.number().int().min(0).max(100000000),
  tax_rate_bps: z.coerce.number().int().min(0).max(10000),
  service_charge_rate_bps: z.coerce.number().int().min(0).max(10000),
  gratuity_cents: z.coerce.number().int().min(0).max(100000000),
  delivery_fee_cents: z.coerce.number().int().min(0).max(100000000),
  deposit_type: z.enum(["fixed", "percentage"]),
  deposit_value: z.coerce.number().int().min(0).max(100000000),
  expires_at: optionalDateTime,
});
export const quoteLineItemSchema = z.object({
  quote_id: z.uuid(),
  quote_version_id: z.uuid(),
  description: z.string().trim().min(1).max(500),
  details: longNotes,
  quantity_milli: z.coerce.number().int().min(1).max(100000000),
  unit_price_cents: z.coerce.number().int().min(0).max(100000000),
  taxable: z.enum(["true", "false"]).transform((value) => value === "true"),
  display_order: z.coerce.number().int().min(0).max(10000),
});
export const proposalIssueSchema = z.object({
  quote_id: z.uuid(),
  quote_version_id: z.uuid(),
  agreement_terms: z.string().trim().min(20).max(50000),
  queue_email: z.enum(["true", "false"]).transform((value) => value === "true"),
});
/** How long a proposal link stays valid when no Expires date is saved. */
export const DEFAULT_PROPOSAL_VALID_DAYS = 14;
/**
 * F-5: issuing keeps the operator's saved Expires date for both the version and
 * the client link. Only when none is saved does it default to 14 days from issue.
 * Returns null when the saved date has already passed — the operator must pick a
 * new one rather than have it silently replaced.
 */
export function proposalExpiry(saved: string | null | undefined, now: Date = new Date()): string | null {
  if (!saved) return new Date(now.getTime() + DEFAULT_PROPOSAL_VALID_DAYS * 86_400_000).toISOString();
  const at = new Date(saved).getTime();
  return Number.isFinite(at) && at > now.getTime() ? new Date(at).toISOString() : null;
}
export const manualPaymentSchema = z.object({
  event_id: z.uuid(),
  event_financial_id: z.uuid(),
  amount_cents: z.coerce.number().int().positive().max(100000000),
  transaction_type: z.enum(["payment", "refund", "adjustment"]),
  note: z.string().trim().min(3).max(2000),
});
export const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
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
  venue_id: string | null;
  venue_snapshot: Record<string, unknown>;
  start_time: string | null;
  end_time: string | null;
  service_style: string;
  coi_status: (typeof coiStatuses)[number];
  coi_due_at: string | null;
  venue_requirements: string;
  additional_insured_information: string;
  coi_internal_notes: string;
  guest_count_confirmed_at: string | null;
  client_confirmed_at: string | null;
  current_menu_id: string | null;
  created_at: string;
  clients: Client;
};
export type Venue = z.infer<typeof venueSchema> & {
  id: string;
  created_at: string;
  updated_at: string;
};
export type EventMenu = z.infer<typeof eventMenuSchema> & {
  version: number;
  approved_at: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
};
export type EventTask = {
  id: string;
  client_id: string | null;
  lead_id: string | null;
  event_id: string | null;
  title: string;
  description: string;
  category: (typeof taskCategories)[number];
  assignee_id: string | null;
  due_at: string | null;
  status: (typeof taskStatuses)[number];
  priority: (typeof taskPriorities)[number];
  required: boolean;
  completed_at: string | null;
  notes: string;
  automation_key: string | null;
  created_at: string;
  updated_at: string;
};
export type EventDocument = {
  id: string;
  event_id: string;
  client_id: string;
  category: (typeof documentCategories)[number];
  state: "active" | "superseded" | "archived";
  bucket_id: "crm-documents";
  storage_path: string;
  original_filename: string;
  mime_type: "application/pdf" | "image/jpeg" | "image/png";
  size_bytes: number;
  document_group_id: string;
  version: number;
  replaces_document_id: string | null;
  notes: string;
  archived_at: string | null;
  created_at: string;
};
export type QuoteVersion = {
  id: string;
  quote_id: string;
  version: number;
  status: (typeof quoteStatuses)[number];
  title: string;
  introduction: string;
  client_notes: string;
  internal_notes: string;
  currency: "USD";
  discount_cents: number;
  tax_rate_bps: number;
  service_charge_rate_bps: number;
  gratuity_cents: number;
  delivery_fee_cents: number;
  subtotal_cents: number;
  taxable_cents: number;
  tax_cents: number;
  service_charge_cents: number;
  total_cents: number;
  deposit_type: "fixed" | "percentage";
  deposit_value: number;
  deposit_required_cents: number;
  expires_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};
export type QuoteLineItem = {
  id: string;
  quote_version_id: string;
  description: string;
  details: string;
  quantity_milli: number;
  unit_price_cents: number;
  line_total_cents: number;
  taxable: boolean;
  display_order: number;
};
export type Quote = {
  id: string;
  quote_number: number;
  client_id: string;
  lead_id: string;
  event_id: string | null;
  current_version_id: string | null;
  created_at: string;
  clients: Client;
  leads: Lead;
  quote_versions: QuoteVersion[];
};
