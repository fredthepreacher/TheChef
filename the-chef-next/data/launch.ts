/**
 * Launch content gates — every customer-facing claim that still needs owner
 * confirmation is switched off here instead of being deleted, so turning it
 * back on after Chef Frankie verifies it is a one-line change.
 *
 * Rule: if a fact has not been confirmed by the owner, it stays `false`/empty.
 * See docs/LAUNCH-2026-11-06.md → "Owner decisions" for the open questions.
 */

/** Silver / Gold / Platinum cards and their "Starting at $…" prices.
 *  ON since 2026-11-09 by owner direction ("preserve these unless a newer
 *  client-approved source exists"). Provenance: the tiers and prices come
 *  from the previous site (agency HTML drafts). Silver's $800 matches the
 *  older client family menu (public/assets/family_menu.jpg, "PRICE: $800.00");
 *  Gold's $1,500 has no client document. The current printed menu says
 *  "Pricing subject to change", so every card stays "Starting at" and
 *  quote-driven. Chef must still confirm before the production launch. */
export const SHOW_PACKAGE_PRICING = true;

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

/** Draft privacy notice (/privacy). Required before any ad measurement
 *  (NEXT_PUBLIC_GTM_ID) is switched on. Previews show it with a draft
 *  banner; production 404s until the owner approves the wording. */
export const PRIVACY_NOTICE_APPROVED = false;

/** Real, confirmed upcoming performances only. Empty → an "announced soon" state. */
export const UPCOMING_SHOWS: Show[] = [];
