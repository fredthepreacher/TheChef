"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { configured, serverClient } from "@/lib/supabase/server";
import { requireOperator } from "@/lib/auth/require-operator";
import { stageSchema, eventSchema } from "@/lib/crm/domain";
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
