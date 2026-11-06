/**
 * Launch content gates — every customer-facing claim that still needs owner
 * confirmation is switched off here instead of being deleted, so turning it
 * back on after Chef Frankie verifies it is a one-line change.
 *
 * Rule: if a fact has not been confirmed by the owner, it stays `false`/empty.
 * See docs/LAUNCH-2026-11-06.md → "Owner decisions" for the open questions.
 */

/** Silver / Gold / Platinum cards and their "Starting at $…" prices.
 *  Neither printed menu (menu_full_doc.jpg, menu_family_doc.png) lists these
 *  tiers or prices, and real quotes are custom/negotiated. */
export const SHOW_PACKAGE_PRICING = false;

/** "200+ events · 5★ · 8+ years · 12 dishes" (catering) and
 *  "50K+ streams · 12+ tracks · 30+ shows · 3 projects" (music).
 *  Not found in any supplied source — do not publish until verified. */
export const SHOW_UNVERIFIED_STATS = false;

/** Lane B — scheduled delivery / food drops. Stays off until delivery days,
 *  cutoffs, zones, fees, minimums, prices and capacity are confirmed. */
export const DELIVERY_LANE_ENABLED = false;

/** Reported policy: 50% locks the date, balance due the morning of the event.
 *  Keep false until the owner approves the exact public wording. */
export const DEPOSIT_POLICY_APPROVED = false;

export type Show = {
  /** ISO date, e.g. "2026-12-31" */
  date: string;
  venue: string;
  city: string;
  /** Must be a real, working ticket/RSVP link. */
  ticketUrl?: string;
};

/** Real, confirmed upcoming performances only. Empty → the section is hidden. */
export const UPCOMING_SHOWS: Show[] = [];
