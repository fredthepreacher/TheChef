import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort())
    await db.exec(readFileSync(new URL(file, migrations), "utf8"));
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
    "inquiry acknowledgment and follow-up enqueue exactly once",
    async () => {
      const leads = (
        await db.query<{ count: number }>(
          "select count(*)::int as count from leads",
        )
      ).rows[0].count;
      assert.equal(
        (
          await db.query<{ count: number }>(
            "select count(*)::int as count from communications where template_key='inquiry_acknowledgment'",
          )
        ).rows[0].count,
        leads,
      );
      assert.equal(
        (
          await db.query<{ count: number }>(
            "select count(*)::int as count from crm_private.email_outbox",
          )
        ).rows[0].count,
        leads,
      );
      assert.equal(
        (
          await db.query<{ count: number }>(
            "select count(*)::int as count from tasks where automation_key='inquiry_follow_up'",
          )
        ).rows[0].count,
        leads,
      );
    },
  );
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
      for (const table of [
        "clients",
        "leads",
        "events",
        "venues",
        "event_menus",
        "tasks",
        "event_documents",
        "communications",
        "activity_log",
      ]) {
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
    "event gets reusable venue snapshot and operational defaults",
    async () => {
      const venue = (
        await db.query<{ id: string }>(
          "insert into venues(name,address,city,state,postal_code,coi_requirement,insurance_due_days_before_event) values('Test Hall','1 Original Ave','Tampa','FL','33601','required',21) returning id",
        )
      ).rows[0];
      await db.query("update events set venue_id=$1 where id=$2", [
        venue.id,
        eventId,
      ]);
      const event = (
        await db.query<{
          venue_snapshot: { address: string };
          coi_status: string;
          current_menu_id: string;
          coi_due_at: string;
        }>(
          "select venue_snapshot,coi_status,current_menu_id,coi_due_at from events where id=$1",
          [eventId],
        )
      ).rows[0];
      assert.equal(event.venue_snapshot.address, "1 Original Ave");
      assert.equal(event.coi_status, "required");
      assert.ok(event.current_menu_id);
      assert.ok(event.coi_due_at);
      assert.equal(
        (
          await db.query<{ count: number }>(
            "select count(*)::int as count from tasks where event_id=$1",
            [eventId],
          )
        ).rows[0].count,
        6,
      );
      await db.query("update venues set address='2 New Ave' where id=$1", [
        venue.id,
      ]);
      assert.equal(
        (
          await db.query<{ venue_snapshot: { address: string } }>(
            "select venue_snapshot from events where id=$1",
            [eventId],
          )
        ).rows[0].venue_snapshot.address,
        "1 Original Ave",
      );
      await assert.rejects(
        db.query("update events set coi_status='automatically_approved' where id=$1", [
          eventId,
        ]),
        /check constraint/,
      );
    },
  );
  await t.test(
    "menu approval locks a revision and later edits require a new version",
    async () => {
      const first = (
        await db.query<{ id: string }>(
          "select current_menu_id as id from events where id=$1",
          [eventId],
        )
      ).rows[0];
      await db.query(
        "update event_menus set appetizers='Plantain cups',status='approved' where id=$1",
        [first.id],
      );
      await db.query("update event_menus set status='locked' where id=$1", [
        first.id,
      ]);
      const locked = (
        await db.query<{
          approved_at: string;
          locked_at: string;
        }>(
          "select approved_at,locked_at from event_menus where id=$1",
          [first.id],
        )
      ).rows[0];
      assert.ok(locked.approved_at);
      assert.ok(locked.locked_at);
      await assert.rejects(
        db.query("update event_menus set appetizers='Changed' where id=$1", [
          first.id,
        ]),
        /immutable/,
      );
      const second = (
        await db.query<{ id: string }>(
          "insert into event_menus(event_id,version,appetizers,created_by) values($1,2,'Plantain cups',$2) returning id",
          [eventId, owner],
        )
      ).rows[0];
      await db.query("update events set current_menu_id=$1 where id=$2", [
        second.id,
        eventId,
      ]);
      assert.equal(
        (
          await db.query<{ version: number }>(
            "select m.version from events e join event_menus m on m.id=e.current_menu_id where e.id=$1",
            [eventId],
          )
        ).rows[0].version,
        2,
      );
    },
  );
  await t.test(
    "task and document lifecycles are constrained and audited",
    async () => {
      const task = (
        await db.query<{ id: string }>(
          "insert into tasks(event_id,title,category,priority,created_by) values($1,'Pack hot boxes','equipment','high',$2) returning id",
          [eventId, owner],
        )
      ).rows[0];
      await db.query("update tasks set status='complete' where id=$1", [
        task.id,
      ]);
      assert.ok(
        (
          await db.query<{ completed_at: string }>(
            "select completed_at from tasks where id=$1",
            [task.id],
          )
        ).rows[0].completed_at,
      );
      await db.query("update tasks set status='blocked' where id=$1", [task.id]);
      assert.equal(
        (
          await db.query<{ completed_at: string | null }>(
            "select completed_at from tasks where id=$1",
            [task.id],
          )
        ).rows[0].completed_at,
        null,
      );
      const document = (
        await db.query<{
          id: string;
          client_id: string;
          document_group_id: string;
        }>(
          "insert into event_documents(event_id,client_id,category,storage_path,original_filename,mime_type,size_bytes,uploaded_by) values($1,$2,'coi',$3,'coi.pdf','application/pdf',128,$4) returning id,client_id,document_group_id",
          [eventId, randomUUID(), `${eventId}/coi/test.pdf`, owner],
        )
      ).rows[0];
      assert.equal(document.client_id, lead.client_id);
      const replacement = (
        await db.query<{ id: string; document_group_id: string; version: number }>(
          "insert into event_documents(event_id,client_id,category,storage_path,original_filename,mime_type,size_bytes,uploaded_by,replaces_document_id,document_group_id,version) values($1,$2,'coi',$3,'coi-v2.pdf','application/pdf',256,$4,$5,$6,99) returning id,document_group_id,version",
          [
            eventId,
            randomUUID(),
            `${eventId}/coi/test-v2.pdf`,
            owner,
            document.id,
            randomUUID(),
          ],
        )
      ).rows[0];
      assert.equal(replacement.document_group_id, document.document_group_id);
      assert.equal(replacement.version, 2);
      assert.equal(
        (
          await db.query<{ state: string }>(
            "select state from event_documents where id=$1",
            [document.id],
          )
        ).rows[0].state,
        "superseded",
      );
      await db.query("update event_documents set state='archived' where id=$1", [
        replacement.id,
      ]);
      assert.ok(
        (
          await db.query<{ archived_at: string }>(
            "select archived_at from event_documents where id=$1",
            [replacement.id],
          )
        ).rows[0].archived_at,
      );
      await assert.rejects(
        db.query(
          "update event_documents set storage_path='forged.pdf' where id=$1",
          [replacement.id],
        ),
        /immutable/,
      );
      assert.ok(
        (
          await db.query<{ count: number }>(
            "select count(*)::int as count from activity_log where entity_id in ($1,$2,$3)",
            [task.id, document.id, replacement.id],
          )
        ).rows[0].count >= 4,
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
        "select metadata from activity_log where entity_id=$1 and action='update' and metadata->'after'->>'guest_count'='30' order by created_at desc limit 1",
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
      await asRole("authenticated", owner);
      await db.query(
        "delete from storage.objects where bucket_id='crm-documents' and name='test/venue.pdf'",
      );
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        0,
      );
    },
  );
  await db.close();
});
