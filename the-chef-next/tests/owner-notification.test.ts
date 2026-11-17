import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { inquirySchema } from "../lib/crm/domain";
import { prepareInquiry } from "../lib/catering/prepare-inquiry";
import {
  renderEmailTemplate,
  renderOwnerInquiryNotification,
} from "../lib/email/templates";
import { crmLeadUrl, ownerNotificationRecipient } from "../lib/email/owner-notification";
import { THANKSGIVING } from "../data/thanksgiving";

const OWNER = "chef-alerts@example.test";

const payload = (overrides: Record<string, unknown> = {}) => ({
  request_id: randomUUID(),
  first_name: "Alex",
  last_name: "Rivera",
  email: "customer@example.invalid",
  phone: "314 555 0100",
  preferred_contact_method: "phone",
  event_type: "Birthday",
  requested_date: "2099-06-12",
  requested_start_time: "",
  guest_count: "40",
  package_interest: "Gold",
  service_style: "buffet",
  event_location: "Test City, 00000",
  venue_name: "",
  venue_address: "",
  coi_required: "unknown",
  budget: "",
  referral_source: "",
  selected_menu_items: [] as string[],
  menu_notes: "",
  dietary_notes: "",
  inquiry_notes: "",
  consent: true,
  website: "",
  ...overrides,
});

async function boot() {
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
  const asRole = async (role: string) => {
    await db.exec(`reset role; set role ${role}`);
  };
  const prepared = (overrides: Record<string, unknown> = {}) => {
    const { turnstile_token, website, ...fields } = inquirySchema.parse(payload(overrides));
    void turnstile_token;
    void website;
    return prepareInquiry(fields);
  };
  const submit = async (
    p: ReturnType<typeof prepared>,
    owner?: string | null,
    keys = { net: `net:${randomUUID()}`, email: `email:${randomUUID()}` },
  ) => {
    await asRole("service_role");
    const base = [p.inquiry.request_id, JSON.stringify(p.inquiry), JSON.stringify(p.snapshot), keys.net, keys.email];
    if (owner === undefined)
      await db.query("select submit_catering_inquiry($1,$2,$3,$4,$5)", base);
    else await db.query("select submit_catering_inquiry($1,$2,$3,$4,$5,$6)", [...base, owner]);
    await db.exec("reset role");
  };
  const outbox = async (requestId: string) =>
    (
      await db.query<{ template_key: string; recipient_email: string; template_data: Record<string, unknown> }>(
        `select template_key,recipient_email,template_data from crm_private.email_outbox
         where idempotency_key like '%' || $1 order by template_key`,
        [requestId],
      )
    ).rows;
  return { db, asRole, prepared, submit, outbox };
}

test("Chef alert: recipient comes only from server config and is validated", () => {
  assert.equal(ownerNotificationRecipient(undefined), null);
  assert.equal(ownerNotificationRecipient("   "), null);
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...a: unknown[]) => errors.push(a);
  try {
    assert.equal(ownerNotificationRecipient("not-an-email"), null);
  } finally {
    console.error = original;
  }
  assert.equal(errors.length, 1);
  assert.ok(!String(errors[0]).includes("not-an-email"), "the bad value is never logged");
  assert.equal(ownerNotificationRecipient("  Chef-Alerts@Example.TEST "), OWNER);
});

test("Chef alert: CRM link only from an https (or localhost) APP_ORIGIN", () => {
  const id = randomUUID();
  assert.equal(crmLeadUrl(id, "https://thechef-zeta.vercel.app"), `https://thechef-zeta.vercel.app/crm/leads/${id}`);
  assert.equal(crmLeadUrl(id, "http://localhost:3100"), `http://localhost:3100/crm/leads/${id}`);
  assert.equal(crmLeadUrl(id, "http://example.com"), null);
  assert.equal(crmLeadUrl(id, "not a url"), null);
  assert.equal(crmLeadUrl(id, undefined), null);
});

test("Chef alert template: owner-facing, complete, escaped", () => {
  const id = randomUUID();
  const message = renderOwnerInquiryNotification(
    OWNER,
    `owner_inquiry_notification:${id}`,
    {
      lead_id: id,
      first_name: "<Alex>",
      last_name: "Rivera",
      email: "customer@example.invalid",
      phone: "314 555 0100",
      preferred_contact_method: "phone",
      event_type: "Birthday",
      requested_date: "2099-06-12",
      guest_count: "40",
      event_location: "Test City, 00000",
      package_interest: "Thanksgiving Family Feast",
    },
    `https://thechef-zeta.vercel.app/crm/leads/${id}`,
  );
  assert.equal(message.to, OWNER);
  assert.match(message.subject, /^New catering inquiry: <Alex> Rivera · Birthday · 40 guests$/);
  for (const part of ["customer@example.invalid", "314 555 0100", "Test City, 00000", "Thanksgiving Family Feast", "/crm/leads/"])
    assert.ok(message.text.includes(part), part);
  assert.match(message.html, /&lt;Alex&gt;/);
  assert.ok(!message.html.includes("<Alex>"));
  const noLink = renderOwnerInquiryNotification(OWNER, "k", { lead_id: id, first_name: "A", email: "a@b.co", event_type: "Party", requested_date: "2099-01-02", guest_count: 5 }, null);
  assert.match(noLink.text, /Open the CRM → Leads/);
  assert.match(noLink.text, /Phone: Not provided/);
  assert.throws(() => renderOwnerInquiryNotification(OWNER, "k", { lead_id: "x", first_name: "", event_type: "", requested_date: "bad", guest_count: 0 }));
});

test("Chef alert is queued in the intake transaction, once per request, and never blocks intake", async () => {
  const { db, asRole, prepared, submit, outbox } = await boot();

  // 1. Configured → acknowledgment + one alert, recipient normalised.
  const first = prepared();
  await submit(first, "  Chef-Alerts@Example.TEST ");
  let rows = await outbox(first.inquiry.request_id);
  assert.deepEqual(rows.map((r) => r.template_key), ["inquiry_acknowledgment", "owner_inquiry_notification"]);
  const alert = rows[1];
  assert.equal(alert.recipient_email, OWNER);
  const lead = (await db.query<{ id: string }>("select id from public.leads where inquiry->>'request_id'=$1", [first.inquiry.request_id])).rows[0];
  assert.equal(alert.template_data.lead_id, lead.id);
  assert.equal(alert.template_data.package_interest, "Gold");
  // The stored data renders through the dispatcher's template switch.
  const rendered = renderEmailTemplate("owner_inquiry_notification", alert.recipient_email, "k", alert.template_data);
  assert.match(rendered.text, /Alex Rivera/);
  assert.match(rendered.text, /Guests: 40/);

  // 2. Same request retried → still exactly one alert and one acknowledgment.
  await submit(first, OWNER);
  rows = await outbox(first.inquiry.request_id);
  assert.equal(rows.length, 2);
  const comms = await db.query<{ n: number }>(
    "select count(*)::int n from public.communications where template_key='owner_inquiry_notification' and lead_id=$1",
    [lead.id],
  );
  assert.equal(comms.rows[0].n, 1);

  // 3. 5-argument path (no recipient configured) → acknowledgment only.
  const plain = prepared();
  await submit(plain);
  assert.deepEqual((await outbox(plain.inquiry.request_id)).map((r) => r.template_key), ["inquiry_acknowledgment"]);

  // 4. A request first saved without an alert, then retried with one → exactly one alert.
  await submit(plain, OWNER);
  assert.deepEqual((await outbox(plain.inquiry.request_id)).map((r) => r.template_key), ["inquiry_acknowledgment", "owner_inquiry_notification"]);

  // 5. Malformed or empty recipient → intake still succeeds, no alert.
  for (const bad of ["", "nope", null]) {
    const p = prepared();
    await submit(p, bad);
    assert.deepEqual((await outbox(p.inquiry.request_id)).map((r) => r.template_key), ["inquiry_acknowledgment"], String(bad));
  }

  // 6. Thanksgiving orders alert too, with the feast as the package.
  const tg = prepared({
    event_type: "Thanksgiving dinner",
    requested_date: "2099-11-26",
    guest_count: "10",
    package_interest: "Thanksgiving Family Feast",
    thanksgiving: {
      feast: "family",
      sides: THANKSGIVING.sides.slice(0, 4),
      pies: THANKSGIVING.pies.slice(0, 2),
      bread: "",
    },
  });
  await submit(tg, OWNER);
  const tgAlert = (await outbox(tg.inquiry.request_id)).find((r) => r.template_key === "owner_inquiry_notification");
  assert.equal(tgAlert?.template_data.package_interest, "Thanksgiving Family Feast");

  // 7. Only the server role may call the 6-argument overload.
  for (const role of ["anon", "authenticated"]) {
    await asRole(role);
    const p = prepared();
    await assert.rejects(
      db.query("select submit_catering_inquiry($1,$2,$3,$4,$5,$6)", [
        p.inquiry.request_id, JSON.stringify(p.inquiry), JSON.stringify(p.snapshot), "net:x", "email:x", OWNER,
      ]),
      /permission denied/,
      role,
    );
    await db.exec("reset role");
  }
});
