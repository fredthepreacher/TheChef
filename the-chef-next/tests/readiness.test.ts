import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateReadiness } from "../lib/crm/readiness";

const readyEvent = {
  venue_id: "00000000-0000-4000-8000-000000000001",
  venue_snapshot: { name: "Test Hall", address: "1 Main Street" },
  guest_count: 80,
  guest_count_confirmed_at: "2026-09-01T12:00:00Z",
  coi_status: "not_required" as const,
  coi_due_at: null,
  client_confirmed_at: "2026-09-01T12:00:00Z",
};

test("readiness is explainable and excludes neutral payment state", () => {
  const result = calculateReadiness(
    readyEvent,
    { status: "approved" },
    [
      {
        required: true,
        status: "complete",
        due_at: "2026-09-10T12:00:00Z",
        title: "Confirm menu",
      },
    ],
    [],
    new Date("2026-09-11T12:00:00Z"),
  );
  assert.equal(result.status, "ready");
  assert.equal(result.percentage, 100);
  assert.equal(
    result.indicators.find((indicator) => indicator.key === "payment")
      ?.included,
    false,
  );
});

test("missing data lowers readiness instead of implying success", () => {
  const result = calculateReadiness(
    {
      ...readyEvent,
      venue_id: null,
      venue_snapshot: {},
      guest_count_confirmed_at: null,
      coi_status: "requirement_unknown",
      client_confirmed_at: null,
    },
    null,
    [],
    [],
  );
  assert.equal(result.status, "needs_attention");
  assert.ok(result.percentage < 50);
  assert.match(
    result.indicators.find((indicator) => indicator.key === "venue")!.detail,
    /needed/,
  );
});

test("overdue COI, missing document and blocked task surface blockers", () => {
  const result = calculateReadiness(
    {
      ...readyEvent,
      coi_status: "requested",
      coi_due_at: "2026-09-01T12:00:00Z",
    },
    { status: "approved" },
    [
      {
        required: true,
        status: "blocked",
        due_at: "2026-09-10T12:00:00Z",
        title: "Insurer revision",
      },
    ],
    [],
    new Date("2026-09-11T12:00:00Z"),
  );
  assert.equal(result.status, "blocked");
  assert.ok(result.blockers.some((blocker) => blocker.startsWith("COI:")));
  assert.ok(
    result.blockers.some((blocker) => blocker.includes("COI document")),
  );
  assert.ok(
    result.blockers.some((blocker) => blocker.includes("Insurer revision")),
  );
});
