import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { inquirySchema } from "../lib/crm/domain";
import { prepareInquiry } from "../lib/catering/prepare-inquiry";
import { deliverClaimed, inquiryEmailKeys, type OutboxCompletion, type OutboxItem } from "../lib/email/dispatch-core";

// Provider acceptance (2026-11-10): a new inquiry's acknowledgment and Chef's
// alert are sent immediately after intake, and only those two messages. Emails
// an operator queued for an explicit "Send queued emails" must stay queued.

const payload = (requestId: string) => ({
  request_id: requestId,
  first_name: "Dispatch",
  last_name: "Test",
  email: "customer@example.invalid",
  phone: "314 555 0100",
  preferred_contact_method: "email",
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
  const submit = async (requestId: string) => {
    const { turnstile_token, website, ...fields } = inquirySchema.parse(payload(requestId));
    void turnstile_token;
    void website;
    const { inquiry, snapshot } = prepareInquiry(fields);
    await db.exec("reset role; set role service_role");
    await db.query("select submit_catering_inquiry($1,$2,$3,$4,$5,$6)", [
      inquiry.request_id, JSON.stringify(inquiry), JSON.stringify(snapshot),
      `net:${randomUUID()}`, `email:${randomUUID()}`, "chef-alerts@example.test",
    ]);
  };
  const claimByKeys = async (keys: string[]) =>
    (await db.query<{ c: OutboxItem[] }>("select claim_email_outbox_by_keys($1) as c", [keys])).rows[0].c;
  const statuses = async () =>
    (await db.query<{ idempotency_key: string; status: string }>(
      "select idempotency_key,status from crm_private.email_outbox order by idempotency_key",
    )).rows;
  return { db, submit, claimByKeys, statuses };
}

test("the inquiry claim takes only that inquiry's two emails", async () => {
  const { db, submit, claimByKeys, statuses } = await boot();
  const a = randomUUID();
  const b = randomUUID();
  await submit(a);
  await submit(b);
  // An operator-queued email (e.g. a proposal) that must not be sent by intake.
  const [{ id: commId }] = (await db.query<{ id: string }>(
    `insert into public.communications(client_id,lead_id,channel,direction,template_key,recipient,subject,status,idempotency_key)
     select client_id,id,'email','outbound','catering_proposal','customer@example.invalid','Proposal','queued','catering_proposal:operator'
     from public.leads limit 1 returning id`,
  )).rows;
  await db.query(
    `insert into crm_private.email_outbox(communication_id,template_key,recipient_email,template_data,idempotency_key)
     values($1,'catering_proposal','customer@example.invalid','{}'::jsonb,'catering_proposal:operator')`,
    [commId],
  );

  const keysA = inquiryEmailKeys(a);
  assert.deepEqual(
    (await statuses()).filter((r) => keysA.includes(r.idempotency_key)).map((r) => r.idempotency_key).sort(),
    [...keysA].sort(),
    "inquiryEmailKeys matches the keys the intake transaction queues",
  );

  const claimed = await claimByKeys(keysA);
  assert.deepEqual(claimed.map((i) => i.template_key).sort(), ["inquiry_acknowledgment", "owner_inquiry_notification"]);
  assert.deepEqual(claimed.map((i) => i.idempotency_key).sort(), [...keysA].sort());
  const after = await statuses();
  assert.ok(after.filter((r) => keysA.includes(r.idempotency_key)).every((r) => r.status === "processing"));
  assert.ok(after.filter((r) => !keysA.includes(r.idempotency_key)).every((r) => r.status === "queued"),
    "the other inquiry and the operator-queued proposal stay queued");

  assert.deepEqual(await claimByKeys(keysA), [], "a claimed item cannot be claimed twice");
  assert.deepEqual(await claimByKeys([]), []);

  // A failed send is retried by the same scoped claim only after its backoff.
  await db.query("select complete_email_outbox($1,false,null,'delivery_failed','test failure')", [claimed[0].id]);
  assert.deepEqual(await claimByKeys(keysA), [], "backoff: not reclaimed immediately");
  await db.query("update crm_private.email_outbox set available_at=now()-interval '1 second' where id=$1", [claimed[0].id]);
  assert.equal((await claimByKeys(keysA)).length, 1, "retried after backoff");

  for (const role of ["anon", "authenticated"]) {
    await db.exec(`reset role; set role ${role}`);
    await assert.rejects(db.query("select claim_email_outbox_by_keys($1)", [keysA]), /permission denied/);
  }
});

test("delivery records each outcome and never stops at one failure", async () => {
  const completions: OutboxCompletion[] = [];
  const sent: string[] = [];
  const item = (id: string, template_key: string, template_data: unknown): OutboxItem => ({
    id, template_key, recipient_email: "delivered@resend.dev", template_data, idempotency_key: `${template_key}:${id}`,
  });
  const ack = { first_name: "Alex", event_type: "Birthday", requested_date: "2099-06-12", guest_count: 40, package_interest: "Gold" };
  const results = await deliverClaimed(
    [item("1", "inquiry_acknowledgment", ack), item("2", "unknown_template", {}), item("3", "inquiry_acknowledgment", ack)],
    {
      send: async (message) => {
        sent.push(message.idempotencyKey);
        if (sent.length === 2) throw new Error("provider rejected");
        return { providerMessageId: `msg-${sent.length}`, acceptedAt: new Date().toISOString() };
      },
      complete: async (c) => { completions.push(c); },
    },
  );
  assert.deepEqual(results.map((r) => r.status), ["submitted", "failed", "failed"]);
  assert.deepEqual(sent, ["inquiry_acknowledgment:1", "inquiry_acknowledgment:3"], "the provider gets the outbox idempotency key");
  assert.deepEqual(completions.map((c) => [c.p_outbox_id, c.p_success]), [["1", true], ["2", false], ["3", false]]);
  assert.equal(completions[0].p_provider_message_id, "msg-1");
  assert.equal(completions[2].p_error_message, "provider rejected");
});

test("intake sends its own emails after responding; the CRM button sends in-process", () => {
  const route = readFileSync(new URL("../app/api/catering/inquiries/route.ts", import.meta.url), "utf8");
  assert.match(route, /after\(async \(\) => \{[\s\S]*dispatchInquiryEmails\(inquiry\.request_id\)/);
  assert.ok(route.indexOf("after(") > route.indexOf('"Your inquiry could not be saved'), "only after a successful save");
  const actions = readFileSync(new URL("../app/crm/actions.ts", import.meta.url), "utf8");
  const send = actions.slice(actions.indexOf("export async function sendQueuedEmails"), actions.indexOf("export async function saveVenue"));
  assert.match(send, /dispatchQueuedEmails\(\)/);
  assert.doesNotMatch(send, /fetch\(/, "no HTTP hop to the protected deployment");
  const dispatch = readFileSync(new URL("../lib/email/dispatch.ts", import.meta.url), "utf8");
  assert.match(dispatch, /if \(!emailProviderConfigured\(\)\) return \{ configured: false/, "unconfigured: nothing is claimed");
});
