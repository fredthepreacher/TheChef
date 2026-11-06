import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { inquirySchema, stageSchema, eventSchema } from "../lib/crm/domain";
const valid = {
  request_id: randomUUID(),
  first_name: "Test",
  last_name: "Person",
  email: "TEST@example.test",
  phone: "314-555-0100",
  preferred_contact_method: "email",
  event_type: "Dinner",
  requested_date: "2099-10-01",
  guest_count: "25",
  package_interest: "Gold",
  service_style: "buffet",
  coi_required: "unknown",
  consent: true,
};
test("valid inquiry normalizes email and guests", () => {
  const p = inquirySchema.parse(valid);
  assert.equal(p.email, "test@example.test");
  assert.equal(p.guest_count, 25);
});
test("malformed and hostile inquiries fail validation", () => {
  for (const patch of [
    { email: "bad" },
    { consent: false },
    { guest_count: 0 },
    { guest_count: "" },
    { guest_count: 1.5 },
    { guest_count: 10001 },
    { requested_date: "2099-02-30" },
    { requested_date: "2000-01-01" },
    { website: "spam" },
    { status: "booked" },
    { package_interest: "music" },
    { inquiry_notes: "a".repeat(4001) },
    { requested_start_time: "25:01" },
  ])
    assert.equal(
      inquirySchema.safeParse({ ...valid, ...patch }).success,
      false,
      JSON.stringify(patch).slice(0, 100),
    );
});
test("lost stage requires reason and invalid transitions rejected", () => {
  assert.equal(
    stageSchema.safeParse({ id: randomUUID(), status: "lost" }).success,
    false,
  );
  assert.equal(
    stageSchema.safeParse({
      id: randomUUID(),
      status: "lost",
      lost_reason: "No availability",
    }).success,
    true,
  );
  assert.equal(
    stageSchema.safeParse({ id: randomUUID(), status: "paid" }).success,
    false,
  );
});
test("event validation rejects invalid UUIDs, dates and counts", () => {
  assert.equal(
    eventSchema.safeParse({
      id: "bad",
      event_date: "2099-02-30",
      guest_count: 0,
      status: "booked",
    }).success,
    false,
  );
});
