import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_PROPOSAL_VALID_DAYS, proposalExpiry } from "../lib/crm/domain";

// F-5 (hosted re-check 2026-11-10): issuing a proposal always replaced the saved
// Expires date with now + 14 days, for both the version and the client link.

const now = new Date("2026-11-10T21:00:00Z");

test("issuing keeps the saved Expires date", () => {
  assert.equal(proposalExpiry("2026-11-30T22:00:00+00:00", now), "2026-11-30T22:00:00.000Z");
  assert.equal(proposalExpiry("2027-06-01T21:00:00Z", now), "2027-06-01T21:00:00.000Z");
});

test("with no saved date, issuing defaults to 14 days", () => {
  assert.equal(DEFAULT_PROPOSAL_VALID_DAYS, 14);
  for (const empty of [null, undefined, ""])
    assert.equal(proposalExpiry(empty, now), "2026-11-24T21:00:00.000Z");
});

test("a saved date that has passed is refused, never silently replaced", () => {
  assert.equal(proposalExpiry("2026-11-10T20:59:59Z", now), null);
  assert.equal(proposalExpiry("2026-11-10T21:00:00Z", now), null, "expiring at the moment of issue is refused");
  assert.equal(proposalExpiry("not a date", now), null);
});

test("issueProposal passes the resolved expiry, not a fixed 14 days", () => {
  const source = readFileSync(new URL("../app/crm/actions.ts", import.meta.url), "utf8");
  const issue = source.slice(source.indexOf("export async function issueProposal"), source.indexOf("export async function", source.indexOf("export async function issueProposal") + 1));
  assert.match(issue, /proposalExpiry\(version\.expires_at/);
  assert.match(issue, /p_expires_at: expiresAt/);
  assert.doesNotMatch(issue, /86400000|86_400_000/);
});
