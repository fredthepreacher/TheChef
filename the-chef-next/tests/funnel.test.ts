import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { composeMenuNotes, inquirySchema } from "../lib/crm/domain";
import { menuCatalog, normalizeSelection } from "../lib/catering/menu-catalog";

/**
 * Build My Event → CRM, end to end against the real migrations (PGlite):
 * the exact payload the API route sends must create a lead, keep the
 * structured selections, and carry them into the event menu workspace
 * without tripping the 4000-char custom_menu_notes check.
 */
test("Build My Event selections reach the lead and the event menu workspace", async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,service_role; grant execute on function auth.uid() to authenticated,service_role;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,anon; grant select,insert,update,delete on storage.objects to authenticated,anon;`);
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(migrations).filter((n) => n.endsWith(".sql")).sort())
    await db.exec(readFileSync(new URL(file, migrations), "utf8"));

  const owner = randomUUID();
  await db.query("insert into auth.users values ($1)", [owner]);
  await db.query("insert into profiles(id,role) values ($1,'owner')", [owner]);
  const asRole = async (role: string, id = "") => {
    await db.exec(`reset role; set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  };

  // Worst case on purpose: every selectable dish + the longest guest notes.
  const everything = normalizeSelection(menuCatalog.map((i) => i.key));
  const parsed = inquirySchema.parse({
    request_id: randomUUID(),
    first_name: "Funnel",
    last_name: "Guest",
    email: "funnel@example.test",
    phone: "314-555-0101",
    preferred_contact_method: "phone",
    event_type: "Birthday",
    requested_date: "2099-03-14",
    guest_count: "40",
    event_location: "St. Louis, 63101",
    package_interest: "Unsure",
    service_style: "private_chef",
    coi_required: "unknown",
    selected_menu_items: everything,
    menu_notes: "n".repeat(1500),
    consent: true,
  });
  // Mirror app/api/catering/inquiries/route.ts exactly.
  const { turnstile_token, website, ...fields } = parsed;
  void turnstile_token;
  void website;
  const inquiry = { ...fields, menu_notes: composeMenuNotes(fields.selected_menu_items, fields.menu_notes) };

  await asRole("service_role");
  await db.query("select submit_catering_inquiry($1,$2,$3,$4,$5)", [
    inquiry.request_id,
    JSON.stringify(inquiry),
    JSON.stringify({ badge: "Unsure", price: { prefix: "Custom", strong: "Pricing" } }),
    "net:funnel",
    "email:funnel",
  ]);

  await asRole("authenticated", owner);
  const lead = (
    await db.query<{
      id: string;
      client_id: string;
      inquiry: { selected_menu_items: string[]; event_location: string; menu_notes: string };
    }>("select id,client_id,inquiry from leads")
  ).rows[0];
  assert.equal(lead.inquiry.selected_menu_items.length, everything.length);
  assert.equal(lead.inquiry.event_location, "St. Louis, 63101");
  assert.match(lead.inquiry.menu_notes, /^Selected on website:\nAppetizers: /);

  // Convert to an event (same path as the CRM "Create / open event workspace").
  const event = (
    await db.query<{ id: string; current_menu_id: string }>(
      "insert into events(lead_id,client_id,event_type,event_date,guest_count,package_snapshot,menu_snapshot) values($1,$2,'x','2099-03-14',40,'{}','{}') returning id,current_menu_id",
      [lead.id, lead.client_id],
    )
  ).rows[0];
  const menu = (
    await db.query<{ custom_menu_notes: string }>(
      "select m.custom_menu_notes from events e join event_menus m on m.id=e.current_menu_id where e.id=$1",
      [event.id],
    )
  ).rows[0];
  assert.ok(menu, "event menu workspace was created");
  assert.match(menu.custom_menu_notes, /Main Course: .*Oxtail/);
  assert.ok(menu.custom_menu_notes.length <= 4000);
});
