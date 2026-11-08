import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

/**
 * Regression for hosted UI acceptance defects found on 2026-11-08:
 *  D-1  a quote revision could never be issued (second agreements row for the
 *       same event violated agreements.event_id uniqueness);
 *  D-2  a client revision request / decline that included a message failed
 *       because the message was appended to the immutable issued version.
 * Runs the full operator ↔ client journey against the real migrations.
 */
test("proposal revisions, client messages and final acceptance", async () => {
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
  const outsider = randomUUID();
  await db.query("insert into auth.users values ($1),($2)", [owner, outsider]);
  await db.query("insert into profiles(id,role) values ($1,'owner')", [owner]);
  const asRole = async (role: string, id = "") => {
    await db.exec(`reset role; set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  };
  const sha = (value: string) => createHash("sha256").update(value).digest("hex");
  const net = sha("network");
  const terms = { terms: "Regression-test catering agreement terms." };

  // Inquiry → lead (service role, exactly like the public intake route)
  await asRole("service_role");
  const requestId = randomUUID();
  await db.query("select submit_catering_inquiry($1,$2,$3,$4,$5)", [
    requestId,
    JSON.stringify({
      request_id: requestId, first_name: "Rev", last_name: "Test", email: "rev@example.test",
      phone: "3145550100", preferred_contact_method: "email", referral_source: "test",
      event_type: "Dinner", requested_date: "2099-10-01", guest_count: 25,
      package_interest: "Unsure", menu_notes: "", dietary_notes: "", consent: true,
    }),
    JSON.stringify({ badge: "Unsure" }),
    "net:rev",
    "email:rev",
  ]);
  const lead = (await db.query<{ id: string }>("select id from leads")).rows[0];

  // Operator: quote + v1
  await asRole("authenticated", owner);
  const quoteId = (await db.query<{ q: string }>("select create_quote_for_lead($1) as q", [lead.id])).rows[0].q;
  const currentVersion = async () =>
    (await db.query<{ id: string }>("select current_version_id as id from quotes where id=$1", [quoteId])).rows[0].id;
  const addLine = async (versionId: string, cents: number) =>
    db.query(
      "insert into quote_line_items(quote_version_id,description,quantity_milli,unit_price_cents) values($1,'Dinner service',1000,$2)",
      [versionId, cents],
    );
  const issue = async (versionId: string, token: string) =>
    db.query("select prepare_and_issue_proposal($1,$2,$3,$4,now()+interval '7 days')", [
      versionId, JSON.stringify(terms), sha(JSON.stringify(terms)), sha(token),
    ]);

  const v1 = await currentVersion();
  await addLine(v1, 100000);
  await issue(v1, "token-v1");

  // D-2: client requests a revision WITH a message
  await asRole("service_role");
  await db.query("select respond_to_proposal_by_token($1,'revision_requested',$2,$3)", [
    sha("token-v1"), "Please add a dessert station.", net,
  ]);
  await asRole("authenticated", owner);
  const v1Row = (await db.query<{ status: string; client_notes: string }>(
    "select status,client_notes from quote_versions where id=$1", [v1],
  )).rows[0];
  assert.equal(v1Row.status, "revision_requested");
  assert.equal(v1Row.client_notes, "", "issued version notes must not be mutated");
  assert.equal((await db.query<{ status: string }>("select status from leads where id=$1", [lead.id])).rows[0].status, "awaiting_decision");
  const responses1 = (await db.query<{ r: Array<{ action: string; message: string; version: number }> }>(
    "select list_proposal_responses($1) as r", [quoteId],
  )).rows[0].r;
  assert.deepEqual(
    responses1.map((x) => [x.version, x.action, x.message]),
    [[1, "revision_requested", "Please add a dessert station."]],
  );

  // D-1: revision v2 can be issued for the same event
  await db.query("select create_quote_revision($1)", [quoteId]);
  const v2 = await currentVersion();
  assert.notEqual(v2, v1);
  await addLine(v2, 15000);
  await issue(v2, "token-v2");
  const agreements = (await db.query<{ n: number; versions: number; current_is_v2: boolean }>(
    `select count(distinct a.id)::int n, count(av.id)::int versions,
            bool_and(a.current_version_id = (select id from agreement_versions where quote_version_id=$1)) current_is_v2
       from agreements a join agreement_versions av on av.agreement_id=a.id
      where a.quote_id=$2`, [v2, quoteId],
  )).rows[0];
  assert.deepEqual(agreements, { n: 1, versions: 2, current_is_v2: true });
  assert.deepEqual(
    (await db.query<{ version: number; status: string }>(
      "select av.version,av.status from agreement_versions av join agreements a on a.id=av.agreement_id where a.quote_id=$1 order by av.version",
      [quoteId],
    )).rows.map((r) => [r.version, r.status]),
    [[1, "superseded"], [2, "sent"]],
  );

  // Old link is dead; client declines v2 WITH a message
  await asRole("service_role");
  await assert.rejects(
    db.query("select respond_to_proposal_by_token($1,'declined','',$2)", [sha("token-v1"), net]),
    /invalid or expired/,
  );
  await db.query("select respond_to_proposal_by_token($1,'declined',$2,$3)", [sha("token-v2"), "Over our budget.", net]);
  await asRole("authenticated", owner);
  const lost = (await db.query<{ status: string; lost_reason: string }>("select status,lost_reason from leads where id=$1", [lead.id])).rows[0];
  assert.deepEqual(lost, { status: "lost", lost_reason: "Over our budget." });

  // Revision v3 → issued → accepted → deposit pending
  await db.query("select create_quote_revision($1)", [quoteId]);
  const v3 = await currentVersion();
  await issue(v3, "token-v3");
  await asRole("service_role");
  await db.query("select accept_proposal_by_token($1,'Rev Test','I agree to the catering service agreement.',$2,'Test')", [
    sha("token-v3"), sha("ip"),
  ]);
  await asRole("authenticated", owner);
  assert.equal(
    (await db.query<{ s: string }>("select commercial_status s from event_financials ef join quotes q on q.event_id=ef.event_id where q.id=$1", [quoteId])).rows[0].s,
    "approved_deposit_pending",
  );
  assert.equal((await db.query<{ status: string }>("select status from quote_versions where id=$1", [v3])).rows[0].status, "approved");
  const finalResponses = (await db.query<{ r: Array<{ action: string; version: number }> }>(
    "select list_proposal_responses($1) as r", [quoteId],
  )).rows[0].r;
  assert.deepEqual(
    finalResponses.map((x) => [x.version, x.action]).sort(),
    [[1, "revision_requested"], [2, "declined"], [3, "accepted"]].sort(),
  );

  // Accepted agreement cannot be replaced by another issue on the same event
  await assert.rejects(db.query("select create_quote_revision($1)", [quoteId]), /cannot be revised/);

  // Response history is operator-only
  await asRole("authenticated", outsider);
  await assert.rejects(db.query("select list_proposal_responses($1)", [quoteId]), /Forbidden/);
  await asRole("anon");
  await assert.rejects(db.query("select list_proposal_responses($1)", [quoteId]), /permission denied/);
});
