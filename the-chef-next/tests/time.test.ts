import { test } from "node:test";
import assert from "node:assert/strict";
import { etInputToIso, formatEtDate, formatEtDateTime, toEtInputValue } from "../lib/crm/time";
import { quoteSettingsSchema, taskSchema } from "../lib/crm/domain";

// F-2 (hosted acceptance 2026-11-10): CRM times rendered in the server's UTC
// with no label, and datetime-local values were stored as if typed in UTC.

test("CRM timestamps are shown in Eastern time with a label", () => {
  assert.equal(formatEtDateTime("2026-11-10T19:15:51Z"), "11/10/2026, 2:15:51 PM ET");
  assert.equal(formatEtDateTime("2026-07-04T16:00:00Z"), "7/4/2026, 12:00:00 PM ET");
  assert.equal(formatEtDate("2026-11-25T03:30:00Z"), "11/24/2026", "late-evening ET stays on the ET date");
  assert.equal(formatEtDateTime(null), "");
  assert.equal(formatEtDateTime("not a date"), "");
});

test("datetime-local values round-trip as Eastern wall time across DST", () => {
  // Standard time (UTC-5) and daylight time (UTC-4).
  assert.equal(etInputToIso("2026-11-24T17:00"), "2026-11-24T22:00:00.000Z");
  assert.equal(etInputToIso("2026-07-01T17:00"), "2026-07-01T21:00:00.000Z");
  assert.equal(etInputToIso("2026-07-01T17:00:30"), "2026-07-01T21:00:30.000Z");
  // Days of the change: before and after the switch.
  assert.equal(etInputToIso("2026-11-01T00:30"), "2026-11-01T04:30:00.000Z");
  assert.equal(etInputToIso("2026-11-01T03:00"), "2026-11-01T08:00:00.000Z");
  assert.equal(etInputToIso("2027-03-14T01:00"), "2027-03-14T06:00:00.000Z");
  assert.equal(etInputToIso("2027-03-14T04:00"), "2027-03-14T08:00:00.000Z");
  assert.throws(() => etInputToIso("2026-11-24"), RangeError);

  assert.equal(toEtInputValue("2026-11-24T22:00:00+00:00"), "2026-11-24T17:00");
  assert.equal(toEtInputValue("2026-07-01T21:00:00Z"), "2026-07-01T17:00");
  assert.equal(toEtInputValue(null), "");
  for (const local of ["2026-11-24T17:00", "2026-07-01T09:15", "2026-12-31T23:59"])
    assert.equal(toEtInputValue(etInputToIso(local)), local);
});

test("form schemas store datetime-local input as the Eastern instant", () => {
  const quote = quoteSettingsSchema.parse({
    id: "00000000-0000-4000-8000-000000000001",
    quote_id: "00000000-0000-4000-8000-000000000002",
    title: "Proposal",
    discount_cents: 0,
    tax_rate_bps: 0,
    service_charge_rate_bps: 0,
    gratuity_cents: 0,
    delivery_fee_cents: 0,
    deposit_type: "percentage",
    deposit_value: 2500,
    expires_at: "2026-11-24T17:00",
  });
  assert.equal(quote.expires_at, "2026-11-24T22:00:00.000Z");
  assert.equal(quoteSettingsSchema.shape.expires_at.parse(""), null);

  const task = taskSchema.safeParse({
    id: "",
    assignee_id: "",
    description: "",
    notes: "",
    title: "Confirm venue",
    category: "venue",
    status: "todo",
    priority: "normal",
    required: "true",
    due_at: "2027-05-13T17:00",
    event_id: "00000000-0000-4000-8000-000000000003",
  });
  if (task.success) assert.equal(task.data.due_at, "2027-05-13T21:00:00.000Z");
  else assert.fail(`taskSchema rejected a valid task: ${task.error.message}`);
});
