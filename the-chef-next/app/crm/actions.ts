"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { configured, serverClient } from "@/lib/supabase/server";
import { requireOperator } from "@/lib/auth/require-operator";
import {
  stageSchema,
  eventSchema,
  eventOperationsSchema,
  eventMenuSchema,
  taskSchema,
  venueSchema,
} from "@/lib/crm/domain";
export async function login(form: FormData) {
  if (!configured()) redirect("/crm/login?error=setup");
  const parsed = z
    .object({ email: z.email().max(254), password: z.string().min(1).max(200) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/login?error=login");
  const db = await serverClient();
  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error) redirect("/crm/login?error=login");
  await requireOperator();
  redirect("/crm");
}
export async function logout() {
  if (configured()) {
    const db = await serverClient();
    await db.auth.signOut();
  }
  redirect("/crm/login");
}
export async function updateStage(form: FormData) {
  const { db } = await requireOperator();
  const parsed = stageSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/leads?error=validation");
  const { id, status, lost_reason } = parsed.data;
  const { data, error } = await db
    .from("leads")
    .update({ status, lost_reason: status === "lost" ? lost_reason : null })
    .eq("id", id)
    .select("id")
    .single();
  if (error || !data) redirect(`/crm/leads/${id}?error=save`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/leads/${id}?saved=1`);
}
export async function convertLead(form: FormData) {
  const { db } = await requireOperator();
  const parsed = z.uuid().safeParse(form.get("id"));
  if (!parsed.success) redirect("/crm/leads?error=validation");
  const id = parsed.data;
  const { data: existing } = await db
    .from("events")
    .select("id")
    .eq("lead_id", id)
    .maybeSingle();
  if (existing) redirect(`/crm/events/${existing.id}`);
  const { data: lead, error: readError } = await db
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();
  if (readError || !lead) redirect("/crm/leads?error=missing");
  const { data: event, error } = await db
    .from("events")
    .insert({
      lead_id: id,
      client_id: lead.client_id,
      event_type: lead.event_type,
      event_date: lead.requested_date,
      guest_count: lead.guest_count,
      package_snapshot: lead.package_snapshot,
      menu_snapshot: {},
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const { data: duplicate } = await db
      .from("events")
      .select("id")
      .eq("lead_id", id)
      .single();
    if (duplicate) redirect(`/crm/events/${duplicate.id}`);
  }
  if (error || !event) redirect(`/crm/leads/${id}?error=conversion`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/events/${event.id}`);
}
export async function updateEvent(form: FormData) {
  const { db } = await requireOperator();
  const parsed = eventSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/events?error=validation");
  const { id, ...changes } = parsed.data;
  const { data, error } = await db
    .from("events")
    .update(changes)
    .eq("id", id)
    .select("id")
    .single();
  if (error || !data) redirect(`/crm/events/${id}?error=save`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/events/${id}?saved=1`);
}
export async function updateClient(form: FormData) {
  const { db } = await requireOperator();
  const parsed = z
    .object({
      id: z.uuid(),
      notes: z.string().trim().max(4000),
      archived: z.enum(["true", "false"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/clients?error=validation");
  const { id, notes, archived } = parsed.data;
  const { data, error } = await db
    .from("clients")
    .update({ notes, archived: archived === "true" })
    .eq("id", id)
    .select("id")
    .single();
  if (error || !data) redirect(`/crm/clients/${id}?error=save`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/clients/${id}?saved=1`);
}

export async function saveVenue(form: FormData) {
  const { db } = await requireOperator();
  const parsed = venueSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/venues?error=validation");
  const { id, ...values } = parsed.data;
  if (id) {
    const { error } = await db.from("venues").update(values).eq("id", id);
    if (error) redirect(`/crm/venues/${id}?error=save`);
    revalidatePath("/crm", "layout");
    redirect(`/crm/venues/${id}?saved=1`);
  }
  const { data, error } = await db
    .from("venues")
    .insert(values)
    .select("id")
    .single();
  if (error || !data) redirect("/crm/venues?error=save");
  revalidatePath("/crm", "layout");
  redirect(`/crm/venues/${data.id}?saved=1`);
}

export async function updateEventOperations(form: FormData) {
  const { db } = await requireOperator();
  const parsed = eventOperationsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/events?error=validation");
  const { id, ...values } = parsed.data;
  const { error } = await db.from("events").update(values).eq("id", id);
  if (error) redirect(`/crm/events/${id}?error=save`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/events/${id}?saved=1#venue-coi`);
}

export async function setEventConfirmation(form: FormData) {
  const { db } = await requireOperator();
  const parsed = z
    .object({
      id: z.uuid(),
      field: z.enum(["guest_count_confirmed_at", "client_confirmed_at"]),
      confirmed: z.enum(["true", "false"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/events?error=validation");
  const { id, field, confirmed } = parsed.data;
  const { error } = await db
    .from("events")
    .update({ [field]: confirmed === "true" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) redirect(`/crm/events/${id}?error=save`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/events/${id}?saved=1`);
}

export async function updateEventMenu(form: FormData) {
  const { db } = await requireOperator();
  const parsed = eventMenuSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/events?error=validation");
  const { id, event_id, ...values } = parsed.data;
  const { error } = await db.from("event_menus").update(values).eq("id", id);
  if (error) redirect(`/crm/events/${event_id}?error=menu`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/events/${event_id}?saved=1#menu`);
}

export async function createMenuRevision(form: FormData) {
  const { db, user } = await requireOperator();
  const parsed = z
    .object({ event_id: z.uuid(), menu_id: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/crm/events?error=validation");
  const { event_id, menu_id } = parsed.data;
  const { data: current, error: readError } = await db
    .from("event_menus")
    .select("*")
    .eq("id", menu_id)
    .eq("event_id", event_id)
    .single();
  if (readError || !current) redirect(`/crm/events/${event_id}?error=menu`);
  const {
    id: _id,
    created_at: _created,
    updated_at: _updated,
    approved_at: _approved,
    locked_at: _locked,
    created_by: _creator,
    ...copy
  } = current;
  void [_id, _created, _updated, _approved, _locked, _creator];
  const { data: revision, error } = await db
    .from("event_menus")
    .insert({
      ...copy,
      version: current.version + 1,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !revision) redirect(`/crm/events/${event_id}?error=menu`);
  const { error: linkError } = await db
    .from("events")
    .update({ current_menu_id: revision.id })
    .eq("id", event_id);
  if (linkError) redirect(`/crm/events/${event_id}?error=menu`);
  revalidatePath("/crm", "layout");
  redirect(`/crm/events/${event_id}?saved=1#menu`);
}

export async function saveTask(form: FormData) {
  const { db, user } = await requireOperator();
  const parsed = taskSchema.safeParse(Object.fromEntries(form));
  const fallback = String(form.get("event_id") || "");
  if (!parsed.success)
    redirect(fallback ? `/crm/events/${fallback}?error=task` : "/crm/tasks?error=validation");
  const { id, ...values } = parsed.data;
  const destination = values.event_id
    ? `/crm/events/${values.event_id}`
    : "/crm/tasks";
  if (id) {
    const { error } = await db.from("tasks").update(values).eq("id", id);
    if (error) redirect(`${destination}?error=task`);
  } else {
    if (!values.event_id) redirect("/crm/tasks?error=validation");
    const { error } = await db
      .from("tasks")
      .insert({ ...values, created_by: user.id });
    if (error) redirect(`${destination}?error=task`);
  }
  revalidatePath("/crm", "layout");
  redirect(`${destination}?saved=1${values.event_id ? "#tasks" : ""}`);
}
