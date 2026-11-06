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
const optionalUuid = z
  .union([z.literal(""), z.uuid()])
  .transform((value) => value || null);
const optionalDateTime = z
  .union([z.literal(""), z.iso.datetime({ local: true })])
  .transform((value) => value || null);
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
