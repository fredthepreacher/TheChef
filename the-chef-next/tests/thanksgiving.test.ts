import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { inquirySchema, packageOptions } from "../lib/crm/domain";
import { prepareInquiry } from "../lib/catering/prepare-inquiry";
import { THANKSGIVING, composeThanksgivingNotes, feastSnapshot } from "../data/thanksgiving";

/** The exact JSON body the browser sent in Thanksgiving mode (captured from
 *  the running form on 2026-11-09, request_id refreshed per test). */
const browserPayload = () => ({
  menu_notes: "No nuts please",
  event_type: "Thanksgiving dinner",
  requested_date: "2099-11-26",
  requested_start_time: "",
  guest_count: "8",
  event_location: "St. Louis, 63101",
  venue_name: "",
  venue_address: "",
  service_style: "drop_off",
  coi_required: "unknown",
  first_name: "Test",
  last_name: "Guest",
  email: "qa@example.invalid",
  phone: "314 555 0100",
  preferred_contact_method: "email",
  dietary_notes: "",
  inquiry_notes: "",
  budget: "",
  referral_source: "",
  website: "",
  consent: true,
  package_interest: "Thanksgiving Intimate Feast",
  selected_menu_items: [] as string[],
  thanksgiving: {
    feast: "intimate",
    sides: ["Cornbread Stuffing", "Mashed Potatoes & Gravy", "Candied Sweet Potatoes"],
    pies: ["Pumpkin"],
    bread: "Cornbread",
  },
  attribution: {
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "thanksgiving-2026",
    gclid: "TEST-GCLID-123",
    landing_path: "/thanksgiving",
    captured_at: "2026-11-09T09:41:21.043Z",
  },
  request_id: randomUUID(),
  turnstile_token: "",
});

test("every feast maps to a CRM package option", () => {
  for (const f of THANKSGIVING.feasts)
    assert.ok((packageOptions as readonly string[]).includes(f.packageInterest), f.packageInterest);
});

test("the captured Thanksgiving browser payload validates", () => {
  const p = inquirySchema.parse(browserPayload());
  assert.equal(p.thanksgiving?.feast, "intimate");
  assert.equal(p.attribution?.gclid, "TEST-GCLID-123");
});

test("feast rules: package must match, limits enforced, no catering dishes", () => {
  const bad = (patch: Record<string, unknown>) =>
    inquirySchema.safeParse({ ...browserPayload(), ...patch }).success;
  assert.equal(bad({ package_interest: "Thanksgiving Grand Feast" }), false, "feast/package mismatch");
  assert.equal(bad({ package_interest: "Gold" }), false, "catering package with a feast order");
  assert.equal(
    bad({ thanksgiving: { feast: "intimate", sides: ["Collard Greens", "Rice & Peas", "Corn on the Cob", "Garden Salad"], pies: [], bread: "" } }),
    false,
    "4 sides on a 3-side feast",
  );
  assert.equal(bad({ thanksgiving: { feast: "intimate", sides: [], pies: ["Pumpkin", "Pecan"], bread: "" } }), false, "2 pies on a 1-pie feast");
  assert.equal(bad({ thanksgiving: { feast: "intimate", sides: ["Collard Greens", "Collard Greens"], pies: [], bread: "" } }), false, "duplicate side");
  assert.equal(bad({ thanksgiving: { feast: "intimate", sides: ["Turducken"], pies: [], bread: "" } }), false, "unknown side");
  assert.equal(bad({ thanksgiving: { feast: "intimate", sides: [], pies: [], bread: "Rolls" } }), false, "unknown bread");
  assert.equal(bad({ thanksgiving: undefined }), false, "feast package without the order details");
  assert.equal(bad({ selected_menu_items: ["Main Course: Oxtail"] }), false, "catering dishes mixed in");
});

test("attribution is best-effort: malformed data is dropped, never rejects the lead", () => {
  const p = inquirySchema.parse({ ...browserPayload(), attribution: { gclid: 42, utm_source: "x".repeat(5000) } });
  assert.equal(p.attribution, undefined);
  const q = inquirySchema.parse({ ...browserPayload(), attribution: { utm_source: "meta", unknown_key: "kept out" } });
  assert.deepEqual(q.attribution, { utm_source: "meta" });
});

test("catering inquiries are unchanged (Gold package, no feast)", () => {
  const { thanksgiving, ...rest } = browserPayload();
  void thanksgiving;
  const p = inquirySchema.parse({ ...rest, package_interest: "Gold", event_type: "Birthday" });
  const { inquiry, snapshot, feast } = prepareInquiry(p);
  assert.equal(feast, undefined);
  assert.equal((snapshot as { badge: string }).badge, "Gold");
  assert.equal(inquiry.menu_notes, "No nuts please");
});

test("server builds the feast summary and price snapshot from catalog data", () => {
  const p = inquirySchema.parse(browserPayload());
  const { inquiry, snapshot, feast } = prepareInquiry(p);
  assert.equal(feast?.price, 350);
  assert.deepEqual(snapshot, feastSnapshot(feast!));
  assert.equal((snapshot as { price: { strong: string } }).price.strong, "$350");
  assert.equal(
    inquiry.menu_notes,
    [
      "Thanksgiving 2026 order request — The Intimate Feast (serves 6–8, listed at $350)",
      "Sides (3 of 3): Cornbread Stuffing, Mashed Potatoes & Gravy, Candied Sweet Potatoes",
      "Pies (1 of 1): Pumpkin",
      "Bread: Cornbread",
      "",
      "Guest notes:",
      "No nuts please",
    ].join("\n"),
  );
  // Empty picks read as "Chef to suggest", not blank.
  assert.match(composeThanksgivingNotes({ feast: "grand", sides: [], pies: [], bread: "" }, ""), /Sides \(0 of 6\): Chef to suggest/);
});

test("a Thanksgiving order reaches the CRM lead and the event menu workspace", async () => {
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

  // Worst case: biggest feast, every slot filled, longest guest notes.
  const parsed = inquirySchema.parse({
    ...browserPayload(),
    package_interest: "Thanksgiving Grand Feast",
    guest_count: "20",
    thanksgiving: { feast: "grand", sides: THANKSGIVING.sides.slice(0, 6), pies: THANKSGIVING.pies.slice(0, 3), bread: "" },
    menu_notes: "n".repeat(1500),
  });
  const { turnstile_token, website, ...fields } = parsed;
  void turnstile_token;
  void website;
  const { inquiry, snapshot } = prepareInquiry(fields);

  await asRole("service_role");
  await db.query("select submit_catering_inquiry($1,$2,$3,$4,$5)", [
    inquiry.request_id,
    JSON.stringify(inquiry),
    JSON.stringify(snapshot),
    "net:tg",
    "email:tg",
  ]);

  await asRole("authenticated", owner);
  const lead = (
    await db.query<{
      id: string;
      client_id: string;
      package_interest: string;
      event_type: string;
      package_snapshot: { price: { strong: string }; occasion: string };
      inquiry: { thanksgiving: { feast: string }; attribution: { gclid: string }; menu_notes: string };
    }>("select id,client_id,package_interest,event_type,package_snapshot,inquiry from leads")
  ).rows[0];
  assert.equal(lead.package_interest, "Thanksgiving Grand Feast");
  assert.equal(lead.event_type, "Thanksgiving dinner");
  assert.equal(lead.package_snapshot.price.strong, "$750");
  assert.equal(lead.package_snapshot.occasion, "thanksgiving-2026");
  assert.equal(lead.inquiry.thanksgiving.feast, "grand");
  assert.equal(lead.inquiry.attribution.gclid, "TEST-GCLID-123");
  assert.match(lead.inquiry.menu_notes, /^Thanksgiving 2026 order request — The Grand Feast/);

  const event = (
    await db.query<{ id: string }>(
      "insert into events(lead_id,client_id,event_type,event_date,guest_count,package_snapshot,menu_snapshot) values($1,$2,'x','2099-11-26',20,'{}','{}') returning id",
      [lead.id, lead.client_id],
    )
  ).rows[0];
  const menu = (
    await db.query<{ custom_menu_notes: string }>(
      "select m.custom_menu_notes from events e join event_menus m on m.id=e.current_menu_id where e.id=$1",
      [event.id],
    )
  ).rows[0];
  assert.match(menu.custom_menu_notes, /Pies \(3 of 3\): Pumpkin, Pecan, Apple/);
  assert.ok(menu.custom_menu_notes.length <= 4000);
});
