import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";

test("migration, atomic intake, RLS, snapshots, audit and private storage", async (t) => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,service_role; grant execute on function auth.uid() to authenticated,service_role;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,anon; grant select,insert,update,delete on storage.objects to authenticated,anon;`);
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/20260909164345_catering_foundation.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const owner = randomUUID(),
    manager = randomUUID(),
    staff = randomUUID(),
    outsider = randomUUID();
  for (const [id, role] of [
    [owner, "owner"],
    [manager, "manager"],
    [staff, "staff"],
    [outsider, ""],
  ]) {
    await db.query("insert into auth.users values ($1)", [id]);
    if (role)
      await db.query("insert into profiles(id,role) values ($1,$2)", [
        id,
        role,
      ]);
  }
  const asRole = async (role: string, id = "") => {
    await db.exec(`reset role; set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  };
  const base = {
    request_id: randomUUID(),
    first_name: "Test",
    last_name: "Client",
    email: "test@example.test",
    phone: "3145550100",
    preferred_contact_method: "email",
    referral_source: "test",
    event_type: "Dinner",
    requested_date: "2099-10-01",
    guest_count: 25,
    package_interest: "Gold",
    menu_notes: "Original menu",
    dietary_notes: "Peanut allergy",
    consent: true,
  };
  const submit = async (body = base, network = "net:1", email = "email:1") =>
    db.query("select submit_catering_inquiry($1,$2,$3,$4,$5)", [
      body.request_id,
      JSON.stringify(body),
      JSON.stringify({ badge: "Gold", features: ["Original package"] }),
      network,
      email,
    ]);
  await asRole("service_role");
  await t.test(
    "valid inquiry and retry create one lead and one client",
    async () => {
      await submit();
      await submit();
      const result = await db.query<{ count: number }>(
        "select count(*)::int as count from leads",
      );
      assert.equal(result.rows[0].count, 1);
      assert.equal(
        (
          await db.query<{ count: number }>(
            "select count(*)::int as count from clients",
          )
        ).rows[0].count,
        1,
      );
    },
  );
  await t.test("retry UUID cannot be reused for changed data", async () => {
    await assert.rejects(
      submit({ ...base, first_name: "Changed" }),
      /Request conflict/,
    );
  });
  await t.test(
    "returning email reuses contact without overwriting details",
    async () => {
      await submit({
        ...base,
        request_id: randomUUID(),
        first_name: "Unverified change",
      });
      assert.equal(
        (
          await db.query<{ first_name: string }>(
            "select first_name from clients",
          )
        ).rows[0].first_name,
        "Test",
      );
      assert.equal(
        (
          await db.query<{ count: number }>(
            "select count(*)::int as count from clients",
          )
        ).rows[0].count,
        1,
      );
    },
  );
  await t.test("durable email limit rejects fourth inquiry", async () => {
    await submit({ ...base, request_id: randomUUID() });
    await assert.rejects(
      submit({ ...base, request_id: randomUUID() }),
      /Too many inquiries/,
    );
  });
  await t.test(
    "anonymous cannot read clients or call privileged intake",
    async () => {
      await asRole("anon");
      await assert.rejects(
        db.query("select * from clients"),
        /permission denied/,
      );
      await assert.rejects(submit(), /permission denied/);
    },
  );
  await t.test("unprovisioned and staff users see no CRM records", async () => {
    for (const id of [outsider, staff]) {
      await asRole("authenticated", id);
      for (const table of ["clients", "leads", "events", "activity_log"]) {
        assert.equal((await db.query(`select * from ${table}`)).rows.length, 0);
      }
      await assert.rejects(
        db.query("insert into profiles(id,role) values ($1,'owner')", [id]),
        /permission denied/,
      );
    }
  });
  await asRole("authenticated", owner);
  const lead = (
    await db.query<{ id: string; client_id: string }>(
      "select id,client_id from leads limit 1",
    )
  ).rows[0];
  await t.test("owner moves stage and audit records actor", async () => {
    await db.query("update leads set status='contacted' where id=$1", [
      lead.id,
    ]);
    const log = await db.query<{
      actor_user_id: string;
      metadata: { after: { status: string } };
    }>(
      "select actor_user_id,metadata from activity_log where entity_id=$1 and action='update'",
      [lead.id],
    );
    assert.equal(log.rows[0].actor_user_id, owner);
    assert.equal(log.rows[0].metadata.after.status, "contacted");
    await assert.rejects(
      db.query("update leads set status='lost',lost_reason=null where id=$1", [
        lead.id,
      ]),
      /check constraint/,
    );
    await db.query(
      "update leads set status='lost',lost_reason='Date unavailable' where id=$1",
      [lead.id],
    );
    await db.query(
      "update leads set status='contacted',lost_reason=null where id=$1",
      [lead.id],
    );
  });
  let eventId = "";
  await t.test(
    "event conversion preserves database-controlled snapshots",
    async () => {
      const e = await db.query<{
        id: string;
        package_snapshot: { badge: string };
        menu_snapshot: { menu_notes: string };
      }>(
        "insert into events(lead_id,client_id,event_type,event_date,guest_count,package_snapshot,menu_snapshot) values($1,$2,'Bad data','2099-10-01',25,'{}','{}') returning *",
        [lead.id, lead.client_id],
      );
      eventId = e.rows[0].id;
      assert.equal(e.rows[0].package_snapshot.badge, "Gold");
      assert.equal(e.rows[0].menu_snapshot.menu_notes, "Original menu");
      await assert.rejects(
        db.query("update events set package_snapshot='{}' where id=$1", [
          eventId,
        ]),
        /permission denied/,
      );
      await assert.rejects(
        db.query(
          "insert into events(lead_id,client_id,event_type,event_date,guest_count,package_snapshot,menu_snapshot) values($1,$2,'Dinner','2099-10-01',25,'{}','{}')",
          [lead.id, lead.client_id],
        ),
        /unique constraint/,
      );
    },
  );
  await t.test(
    "guest count edits logged and hard deletion/audit forgery blocked",
    async () => {
      await db.query("update events set guest_count=30 where id=$1", [eventId]);
      const result = await db.query<{
        metadata: {
          before: { guest_count: number };
          after: { guest_count: number };
        };
      }>(
        "select metadata from activity_log where entity_id=$1 and action='update'",
        [eventId],
      );
      assert.equal(result.rows[0].metadata.before.guest_count, 25);
      assert.equal(result.rows[0].metadata.after.guest_count, 30);
      await assert.rejects(
        db.query("delete from events where id=$1", [eventId]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("update activity_log set action='forged'"),
        /permission denied/,
      );
    },
  );
  await t.test(
    "manager operates but cannot grant roles; deactivation revokes access",
    async () => {
      await asRole("authenticated", manager);
      assert.ok((await db.query("select * from clients")).rows.length);
      await assert.rejects(
        db.query("update profiles set role='owner' where id=$1", [manager]),
        /permission denied/,
      );
      await db.exec("reset role");
      await db.query("update profiles set active=false where id=$1", [manager]);
      await asRole("authenticated", manager);
      assert.equal((await db.query("select * from clients")).rows.length, 0);
    },
  );
  await t.test(
    "storage is private and owner-only operations are enforced",
    async () => {
      await db.exec("reset role");
      assert.ok(
        (
          await db.query<{ public: boolean }>(
            "select public from storage.buckets",
          )
        ).rows.every((b) => !b.public),
      );
      await asRole("authenticated", owner);
      await db.query(
        "insert into storage.objects(bucket_id,name) values('crm-documents','test/venue.pdf')",
      );
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        1,
      );
      for (const [role, id] of [
        ["anon", ""],
        ["authenticated", staff],
        ["authenticated", outsider],
      ]) {
        await asRole(role, id);
        assert.equal(
          (await db.query("select * from storage.objects")).rows.length,
          0,
        );
        await assert.rejects(
          db.query(
            "insert into storage.objects(bucket_id,name) values('crm-documents','bad.pdf')",
          ),
          /row-level security/,
        );
      }
    },
  );
  await db.close();
});
