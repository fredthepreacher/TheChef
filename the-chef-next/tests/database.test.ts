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
  await t.test("email outbox claims, retries and delivery webhooks are idempotent", async () => {
    const claimed = (
      await db.query<{ claim_email_outbox: Array<{ id: string; communication_id: string }> }>(
        "select claim_email_outbox(1)",
      )
    ).rows[0].claim_email_outbox[0];
    assert.ok(claimed.id);
    await db.query("select complete_email_outbox($1,true,$2,null,null)", [
      claimed.id,
      "email_test_provider_id",
    ]);
    const eventId = `wh_${randomUUID()}`;
    assert.equal(
      (
        await db.query<{ process_resend_webhook: boolean }>(
          "select process_resend_webhook($1,'email.delivered',$2,$3)",
          [eventId, "f".repeat(64), "email_test_provider_id"],
        )
      ).rows[0].process_resend_webhook,
      true,
    );
    assert.equal(
      (
        await db.query<{ process_resend_webhook: boolean }>(
          "select process_resend_webhook($1,'email.delivered',$2,$3)",
          [eventId, "f".repeat(64), "email_test_provider_id"],
        )
      ).rows[0].process_resend_webhook,
      false,
    );
    assert.equal(
      (
        await db.query<{ status: string }>(
          "select status from email_delivery_attempts where communication_id=$1",
          [claimed.communication_id],
        )
      ).rows[0].status,
      "delivered",
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
      for (const table of [
        "clients",
        "leads",
        "events",
        "venues",
        "event_menus",
        "tasks",
        "event_documents",
        "communications",
        "quotes",
        "quote_versions",
        "quote_line_items",
        "event_financials",
        "payment_transactions",
        "payment_requests",
        "agreements",
        "agreement_versions",
        "email_delivery_attempts",
        "automation_rules",
        "ai_generations",
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
    "quote totals, client acceptance, deposit gate and ledger are database enforced",
    async () => {
      await asRole("authenticated", owner);
      const quote = (
        await db.query<{ id: string }>(
          "insert into quotes(client_id,lead_id,event_id,created_by) values($1,$2,$3,$4) returning id",
          [lead.client_id, lead.id, eventId, owner],
        )
      ).rows[0];
      const version = (
        await db.query<{ id: string }>(
          "insert into quote_versions(quote_id,version,tax_rate_bps,service_charge_rate_bps,delivery_fee_cents,deposit_type,deposit_value,expires_at,created_by) values($1,1,700,2000,5000,'percentage',2500,now()+interval '7 days',$2) returning id",
          [quote.id, owner],
        )
      ).rows[0];
      await db.query("update quotes set current_version_id=$1 where id=$2", [
        version.id,
        quote.id,
      ]);
      await db.query(
        "insert into quote_line_items(quote_version_id,description,quantity_milli,unit_price_cents) values($1,'Dinner service',25000,2000)",
        [version.id],
      );
      const totals = (
        await db.query<{
          subtotal_cents: number;
          tax_cents: number;
          service_charge_cents: number;
          total_cents: number;
          deposit_required_cents: number;
        }>(
          "select subtotal_cents,tax_cents,service_charge_cents,total_cents,deposit_required_cents from quote_versions where id=$1",
          [version.id],
        )
      ).rows[0];
      assert.deepEqual(totals, {
        subtotal_cents: 50000,
        tax_cents: 3500,
        service_charge_cents: 10000,
        total_cents: 68500,
        deposit_required_cents: 17125,
      });
      await db.query(
        "update quote_versions set total_cents=1,status='ready_for_review' where id=$1",
        [version.id],
      );
      assert.equal(
        (
          await db.query<{ total_cents: number }>(
            "select total_cents from quote_versions where id=$1",
            [version.id],
          )
        ).rows[0].total_cents,
        68500,
      );
      await assert.rejects(
        db.query(
          "update quote_line_items set unit_price_cents=1 where quote_version_id=$1",
          [version.id],
        ),
        /immutable/,
      );
      const agreement = (
        await db.query<{ id: string }>(
          "insert into agreements(event_id,quote_id,created_by) values($1,$2,$3) returning id",
          [eventId, quote.id, owner],
        )
      ).rows[0];
      const agreementVersion = (
        await db.query<{ id: string }>(
          "insert into agreement_versions(agreement_id,quote_version_id,version,status,agreement_snapshot,content_sha256,created_by) values($1,$2,1,'sent',$3,$4,$5) returning id",
          [
            agreement.id,
            version.id,
            JSON.stringify({ terms: "Acceptance test terms" }),
            "b".repeat(64),
            owner,
          ],
        )
      ).rows[0];
      await db.query(
        "update agreements set current_version_id=$1 where id=$2",
        [agreementVersion.id, agreement.id],
      );
      const tokenHash = "a".repeat(64);
      await db.query(
        "select issue_proposal_access($1,$2,now()+interval '7 days')",
        [version.id, tokenHash],
      );
      await assert.rejects(
        db.query("update events set status='booked' where id=$1", [eventId]),
        /deposit has not been recorded/,
      );
      await asRole("service_role");
      const proposal = (
        await db.query<{ get_proposal_by_token: { total_cents: number } }>(
            "select get_proposal_by_token($1,$2)",
            [tokenHash, "e".repeat(64)],
        )
      ).rows[0].get_proposal_by_token;
      assert.equal(proposal.total_cents, 68500);
      assert.equal("internal_notes" in proposal, false);
      assert.equal("proposal_token_id" in proposal, false);
      await db.query(
        "select accept_proposal_by_token($1,'Test Client','I agree to the catering service agreement.',$2,'Test browser')",
        [tokenHash, "c".repeat(64)],
      );
      await asRole("authenticated", owner);
      assert.equal(
        (
          await db.query<{ commercial_status: string }>(
            "select commercial_status from event_financials where event_id=$1",
            [eventId],
          )
        ).rows[0].commercial_status,
        "approved_deposit_pending",
      );
      await assert.rejects(
        db.query("update events set status='booked' where id=$1", [eventId]),
        /deposit has not been recorded/,
      );
      const financial = (
        await db.query<{ id: string }>(
          "select id from event_financials where event_id=$1",
          [eventId],
        )
      ).rows[0];
      await assert.rejects(
        db.query(
          "insert into payment_transactions(event_financial_id,transaction_type,source,amount_cents,idempotency_key,recorded_by,note) values($1,'payment','manual',17125,$2,$3,'Forged operator')",
          [financial.id, randomUUID(), manager],
        ),
        /current CRM operator/,
      );
      await db.query(
        "insert into payment_transactions(event_financial_id,transaction_type,source,amount_cents,idempotency_key,recorded_by,note) values($1,'payment','manual',17125,$2,$3,'Acceptance deposit')",
        [financial.id, randomUUID(), owner],
      );
      assert.equal(
        (
          await db.query<{ commercial_status: string }>(
            "select commercial_status from event_financials where id=$1",
            [financial.id],
          )
        ).rows[0].commercial_status,
        "booked",
      );
      await db.query("update events set status='booked' where id=$1", [eventId]);
      const bookingActions = (
        await db.query<{ list_scheduled_actions: Array<{ name: string; status: string }> }>(
          "select list_scheduled_actions()",
        )
      ).rows[0].list_scheduled_actions;
      assert.equal(
        bookingActions.some((action) => action.name === "Upcoming event reminder" && action.status === "awaiting_approval"),
        true,
      );
      const stripeSession = `cs_test_${randomUUID()}`;
      await db.query(
        "select create_stripe_payment_request($1,'balance',$2,'https://checkout.stripe.test/session',now()+interval '1 day')",
        [financial.id, stripeSession],
      );
      await asRole("service_role");
      const stripeEvent = `evt_${randomUUID()}`;
      await assert.rejects(
        db.query(
          "select process_stripe_checkout_event($1,'checkout.session.completed',$2,$3,$4,true,$5,'usd')",
          [`evt_${randomUUID()}`, "d".repeat(64), stripeSession, `pi_${randomUUID()}`, 1],
        ),
        /amount mismatch/,
      );
      const failedAsyncDelivery = await db.query<{ process_stripe_checkout_event: boolean }>(
        "select process_stripe_checkout_event($1,'checkout.session.async_payment_failed',$2,$3,null,false,$4,'usd')",
        [`evt_${randomUUID()}`, "d".repeat(64), stripeSession, 51375],
      );
      assert.equal(failedAsyncDelivery.rows[0].process_stripe_checkout_event, true);
      const firstDelivery = await db.query<{ process_stripe_checkout_event: boolean }>(
        "select process_stripe_checkout_event($1,'checkout.session.completed',$2,$3,$4,true,$5,'usd')",
        [stripeEvent, "d".repeat(64), stripeSession, `pi_${randomUUID()}`, 51375],
      );
      assert.equal(firstDelivery.rows[0].process_stripe_checkout_event, true);
      const duplicateDelivery = await db.query<{ process_stripe_checkout_event: boolean }>(
        "select process_stripe_checkout_event($1,'checkout.session.completed',$2,$3,$4,true,$5,'usd')",
        [stripeEvent, "d".repeat(64), stripeSession, `pi_${randomUUID()}`, 51375],
      );
      assert.equal(duplicateDelivery.rows[0].process_stripe_checkout_event, false);
      await asRole("authenticated", owner);
      assert.equal(
        (
          await db.query<{ commercial_status: string; balance_remaining_cents: number }>(
            "select commercial_status,balance_remaining_cents from event_financials where id=$1",
            [financial.id],
          )
        ).rows[0].commercial_status,
        "paid",
      );
      await db.query(
        "insert into automation_rules(name,trigger_key,action_key,delay_minutes,requires_operator_approval,active,created_by) values('Acceptance immediate thank-you','event_completed','draft_thank_you',0,true,true,$1)",
        [owner],
      );
      await db.query("update events set status='completed' where id=$1", [eventId]);
      const scheduled = (
        await db.query<{ list_scheduled_actions: Array<{ id: string; name: string; status: string }> }>(
          "select list_scheduled_actions()",
        )
      ).rows[0].list_scheduled_actions;
      const thankYou = scheduled.find((action) => action.name === "Acceptance immediate thank-you");
      assert.equal(thankYou?.status, "awaiting_approval");
      await db.query("select approve_scheduled_action($1,true)", [thankYou?.id]);
      await asRole("service_role");
      assert.equal(
        (
          await db.query<{ process_due_scheduled_actions: number }>(
            "select process_due_scheduled_actions(10)",
          )
        ).rows[0].process_due_scheduled_actions,
        1,
      );
      assert.equal(
        (
          await db.query<{ count: number }>(
            "select count(*)::int as count from crm_private.email_outbox where template_key='draft_thank_you'",
          )
        ).rows[0].count,
        1,
      );
      await asRole("authenticated", owner);
      await assert.rejects(
        db.query("update payment_transactions set amount_cents=1"),
        /permission denied/,
      );
      await assert.rejects(
        db.query(
          "update agreement_versions set accepted_typed_name='Changed' where id=$1",
          [agreementVersion.id],
        ),
        /immutable/,
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
