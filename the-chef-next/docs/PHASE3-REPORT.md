# Phase 3 Revenue Operations Report

**Status:** Local verification, hosted database acceptance, and provider-independent hosted UI acceptance have passed. The remaining Phase 3 boundaries are **Stripe test mode**, then **Resend**, then optional **AI Gateway**. Phase 3 is not marked fully hosted-passed until those approved provider increments are exercised.  
**Account scope:** `wavysites-web` remains inactive by owner direction. It and `geos-ventures's Project` were not resumed, paused, deleted, or otherwise modified during this continuation.  
**Date:** 2026-11-08  
**Branch:** `feat/catering-crm-revenue-ops`  
**Approved Phase 2 base:** `2164ce326d9658c17dcb07cebc96543ce40448aa`  
**Supabase project:** `the-chef-catering-crm` (`pqfyhkehbwikeaongcdo`, `us-east-1`)  

This report deliberately distinguishes implementation from hosted proof. Phase 3 is not marked accepted while the preview, Stripe, Resend and AI Gateway acceptance is incomplete. (The hosted project was paused when this report was first written; it was resumed on 2026-11-08.)

## Migration reconciliation

Phase 1 and Phase 2 migration contents were compared across the approved Phase 2 commit, the hosted canonical timestamp filenames, and the public-site launch branch. The files are byte-for-byte identical:

| Migration | Git blob |
|---|---|
| `20260909200419_catering_foundation.sql` | `0520116caf5e6642285722c8c77115ec68fbc700` |
| `20260911194218_catering_operations.sql` | `a2d0a8ef739837eed7060d1da14414f17aab3ed3` |
| `20260911194632_catering_operations_fk_indexes.sql` | `c693a25b5e2cfce4aaae83fbc029a4cba011942a` |

The old local-only filenames were replaced by their canonical hosted timestamps without changing SQL. No old schema is reapplied under new content, and no hosted reset is planned.

Phase 3 is represented by:

- `20260911210739_catering_revenue_operations.sql` — primary revenue model and workflows.
- `20261108165321_phase3_revenue_hardening.sql` — additive corrections for Stripe amount/currency verification, authenticated manual-payment attribution, approval-gated lifecycle defaults, and upcoming-event reminders.
- `20261108183134_phase3_fk_indexes.sql` — additive indexes for all 15 Phase 3 foreign-key columns identified by the hosted performance advisor.

The primary Phase 3 migration was previously applied to the Chef hosted project. It has not been edited in place since that hosted application. The hardening migration passed the local migration suite and was **applied to hosted on 2026-11-08 at 17:36:40 UTC**, after a dry-run confirmed it was the only pending migration and the owner explicitly approved the push. A later dry-run showed only the new foreign-key-index migration; it was applied alone, and local/remote history now matches across all six canonical versions.

## Fully implemented and locally tested

### Quote and proposal workflow

- Quote identity and immutable numbered revisions.
- Line items with fixed-scale quantity and integer-cent pricing.
- Database-calculated subtotal, discounts, tax, service charge, delivery/travel fee, gratuity, total, and deposit.
- Draft-only editing and immutable sent/accepted snapshots.
- Opaque, hashed, expirable, revocable proposal tokens.
- Server-rendered, `noindex` public proposal projection with no internal notes or provider/private identifiers.
- Approve, decline, and request-revision responses.
- Typed-name consent and immutable agreement snapshot/version/hash/timestamp/evidence.
- UI language explicitly describes electronic acceptance evidence, not a certified e-signature service.

### Payments

- Event financial state and append-only transaction ledger.
- Authenticated operator manual-payment path; the database now requires `recorded_by = auth.uid()` and an active CRM operator.
- Stripe Checkout adapter rejects non-test secret keys.
- Signature verification uses the raw webhook body.
- Provider event IDs and payload digests are persisted with duplicate-event protection.
- Unknown Checkout Sessions and amount/currency mismatches are rejected.
- A success URL cannot change payment state.
- Booking eligibility remains database guarded until the required deposit is posted.

### Transactional email and automation

- Durable private outbox with bounded claims, retry-safe completion, provider IDs, and delivery attempts.
- Resend adapter and signed webhook handling for delivery, delay, bounce, complaint, and failure.
- Idempotent inquiry acknowledgment and proposal email enqueueing.
- Approval-gated rules for quote follow-up, deposit/booking confirmation, upcoming-event reminder, thank-you, review request, and rebooking.
- Fresh installations seed rules when the first active owner is provisioned, rather than depending on an owner existing while migrations run.
- No lifecycle rule sends a commercially meaningful message without operator approval.

### Revenue dashboard and controlled AI

- Revenue distinguishes Quoted, Approved, Collected, Outstanding, and Booked-event value.
- It surfaces proposals awaiting response, near-expiry proposals, approved events awaiting deposit, due deposits, overdue balances, recent payments, follow-ups due, and queued/failed messages.
- AI assistance is operator initiated and limited to summaries, missing-information/next-action analysis, and drafts.
- AI code cannot mutate pricing, discounts, agreements, quote approval, payments, refunds, booking, menu/COI approval, or send a communication.

## Local verification evidence

Executed after the Phase 3 hardening migration and dependency security patches:

| Check | Result |
|---|---|
| `npm test` | Pass — 27 passed, 1 credential-gated HTTP test skipped, 0 failed |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass — zero warnings/errors |
| `npm run build` | Pass — Next.js 15.5.29 production build |
| `npm audit --omit=dev --audit-level=moderate` | Pass — 0 vulnerabilities |
| `npm audit --audit-level=moderate` | Pass — 0 vulnerabilities including dev dependencies |
| tracked-file secret scan | Pass — no committed Stripe, Resend, Supabase, Turnstile, or AI secret value found |

The migration suite specifically proves RLS roles, proposal sanitization, quote totals, electronic acceptance immutability, deposit booking guard, forged manual-payment actor rejection, Stripe amount mismatch rejection, webhook idempotency, email idempotency, automation approval, private Storage, and immutable audit history.

The framework major baseline was not upgraded. Next.js was narrowly patched from 15.5.25 to 15.5.29 and Zod to 4.6.7 to clear disclosed security advisories. React remains 18.

## Hosted Supabase status and blocker

> **Resolved later on 2026-11-08** by the owner-authorized temporary swap (`wavysites-web` paused, Chef project resumed). See "Hosted acceptance window — 2026-11-08". The text below is the original blocker record.

On 2026-11-08 the Supabase dashboard visibly reported:

> Project "the-chef-catering-crm" is paused.

Supabase also reported that `fredthepreacher` has reached the limit of two active Free projects and refused the resume action. The Chef project data, backups, and Storage objects remain safe. No unrelated project was paused, deleted, repurposed, or modified.

Before hosted work can continue, the owner must choose one of these account actions:

1. Deliberately pause another eligible project that is safe to pause; or
2. Approve an organization plan/compute change that permits another active project.

This report does not recommend changing Vertical Ops CRM, DayKare, or Wavy CRM without a new explicit instruction. Any paid option must be quoted and separately approved before purchase.

Once the Chef project is active, the required sequence is:

1. Confirm project health and compare hosted migration history.
2. Run `npx supabase db push --dry-run`.
3. Apply only `20261108165321_phase3_revenue_hardening.sql` if the dry-run confirms that is the sole pending migration.
4. Verify tables, indexes, functions, triggers, RLS, grants, private schemas, and existing Phase 1/2 data.
5. Run Supabase security and performance advisors and record the exact results here.

## Hosted acceptance window — 2026-11-08

### Temporary Supabase project swap (owner-authorized)

The account allows two active Free projects. With explicit owner authorization for an ~24-hour swap:

| Time (local PC) | Action | Result |
|---|---|---|
| 12:15:38 | Paused `wavysites-web` (`knbukykgzjulinlzsyvn`, Wavy Sites LLC, us-east-1) from the dashboard | `PAUSING` |
| 12:16:11 | — | `wavysites-web` **INACTIVE** |
| ~12:18 | Resumed `the-chef-catering-crm` (`pqfyhkehbwikeaongcdo`) from the dashboard | `COMING_UP` (no account-limit refusal) |
| 12:22:25 | — | Chef project **ACTIVE_HEALTHY** |

No other project was touched. `wavy crm`, `wavy-rewards-staging`, `DayKare` and `Vertical Ops CRM` remain paused; `geos-ventures's Project` (separate client organization) remains active and untouched.

**Current owner direction:** keep the Chef project running on the existing Free configuration and do not modify `wavysites-web` or `geos-ventures's Project`. No upgrade or project-state change was made during the continuation documented below.

### Migration state

- Hosted history matched the repo for `20260909200419`, `20260911194218`, `20260911194632` and `20260911210739`.
- `npx supabase db push --linked --dry-run` reported exactly one pending migration: `20261108165321_phase3_revenue_hardening.sql`.
- The first push attempt stopped at the tool-permission boundary. After explicit owner approval, `npx supabase db push --linked --yes` applied it at **17:36:40 UTC**. `npx supabase migration list --linked` now shows all five migrations matching local and remote.
- Before the hardening, hosted ran these definitions (verified from the hosted catalog). All three are fixed now:
  - `process_stripe_checkout_event` has only the 6-argument signature, with **no amount/currency verification**.
  - `crm_private.prepare_payment_transaction` does **not** require `recorded_by = auth.uid()`, so an operator could attribute a manual payment to another operator.
  - 5 automation rules exist, 0 are active, so no upcoming-event reminder is scheduled after booking.
- What the migration wrote to hosted data: 6 `activity_log` rows at 17:36:40 UTC with no user actor. Five existing lifecycle rules were activated, and `Upcoming event reminder` (`event_booked` → `draft_upcoming_event_reminder`) was inserted. All 6 rules are active, and **all 6 have `requires_operator_approval = true`**.

### Hosted schema, RLS, Storage, Auth and health (read-only)

| Check | Result |
|---|---|
| Project status | `ACTIVE_HEALTHY`, Postgres 17.6, database 14 MB, 14 connections |
| Tables in `public` + `crm_private` | 29, **all RLS-enabled**, none without RLS |
| Table grants to `anon` | none |
| `crm_private` grants to `anon`/`authenticated` | none |
| Policies (`public` + `storage`) | 53 |
| SECURITY DEFINER functions | 32, all with pinned `search_path`, none executable by `anon` |
| Storage buckets | `crm-documents`, `crm-client-uploads`, both `public=false`, 0 objects |
| Auth settings | `disable_signup=true`, email confirmation required, no external providers, SAML off |
| Anonymous REST `GET /rest/v1/leads` with the publishable key | **401** |
| Existing data | 1 owner profile / 1 auth user; 0 clients, leads, events; 11 audit rows |

### Hosted database acceptance (rollback-only)

The Phase 1–3 journey was replayed against the **hosted** schema in one PL/pgSQL block. The block always ends by raising an exception, so PostgreSQL discarded every write. It acted as `service_role`, `anon`, an unprovisioned `authenticated` identity, the existing owner identity (JWT claims set only inside the block), and a temporary manager profile created and discarded inside the block.

Run 1 was before the hardening migration. **Run 2 was after it: all 39 checks PASS.**

| # | Check | Result |
|---|---|---|
| A1–A2 | Funnel payload (exact Build My Event shape) creates a lead; same request UUID is idempotent | PASS |
| A3–A4 | Selected dishes (`selected_menu_items`) and event city/ZIP stored | PASS |
| A5–A6 | Follow-up task created; acknowledgment queued, not sent | PASS |
| A7 | Same UUID with changed data rejected (`Request conflict`) | PASS |
| B1–B3 | `anon`: no leads, no quotes, cannot call the intake RPC | PASS |
| B4–B6 | Unprovisioned user: not an operator, sees zero CRM/quote/payment rows, `crm_private` blocked | PASS |
| C1–C2 | Owner is an operator and sees the new lead | PASS |
| C3–C4 | Event menu snapshot **and** event menu workspace contain the website-selected dishes | PASS |
| C5–C7 | Quote totals database-calculated (50000/3500/10000/68500/17125); client total tampering ignored; reviewed lines immutable | PASS |
| D1, D6 | Booking blocked before deposit, before and after acceptance | PASS |
| D2–D4 | Proposal token: correct total, no internal fields, wrong token denied | PASS |
| D5, D7 | Acceptance sets `approved_deposit_pending`; accepted agreement immutable | PASS |
| E2–E3, E5 | Operator deposit moves financials to `booked`; event can then be booked; ledger append-only | PASS |
| E1 | Owner records a manual payment attributed to another valid operator (manager) | Run 1: not valid (foreign key). **Run 2: PASS**, rejected with "Manual entries require the current CRM operator" |
| E4 | Upcoming-event reminder awaits approval after booking | Run 1: FAIL (no active rule). **Run 2: PASS** |
| F1 | Stripe webhook with the wrong amount rejected (`Checkout amount mismatch`) | Run 1: not run. **Run 2: PASS** |
| F2–F3 | First signed-event delivery applied; duplicate delivery of the same event ID ignored | **Run 2: PASS** |
| F4 | Balance paid through the Stripe path moves financials to `paid` | **Run 2: PASS** |
| G1–G2 | Approval-gated thank-you automation: awaits approval, processed after approval | PASS |
| H1 | Operator changes wrote audit rows | PASS |

### Advisors

Advisor results were identical before and after the hardening migration (33 SECURITY DEFINER functions after it, all with pinned `search_path` and none executable by `anon`).

- **Performance:** the hosted advisor initially identified 15 unindexed Phase 3 foreign keys. Additive migration `20261108183134_phase3_fk_indexes.sql` created all 15 indexes. The advisor rerun reported **zero unindexed foreign keys**. It reports unused-index INFO notices because the CRM has no retained business rows after acceptance cleanup; these are expected for the new schema and are not failures.
- **Security:**
  - `auth_leaked_password_protection` (WARN): HaveIBeenPwned checking is off. This is an Auth setting, and leaked-password protection is a paid-plan feature as far as known (the dashboard toggle was not checked). Leave as-is on Free; enable if the project moves to Pro.
  - `authenticated_security_definer_function_executable` (WARN ×9): `approve_scheduled_action`, `create_quote_for_lead`, `create_quote_revision`, `create_stripe_payment_request`, `enqueue_proposal_email`, `issue_proposal_access`, `list_scheduled_actions`, `prepare_and_issue_proposal`, `revoke_proposal_access`. **Assessed as intentional:** each body calls `crm_private.is_operator()` and raises otherwise, and has `search_path=""`. Checks B4–B6 confirm that an unprovisioned signed-in user gets nothing.
  - RLS-without-policy INFO notices on eight `crm_private` tables are intentional deny-by-default design: the private schema grants nothing to `PUBLIC`, `anon`, or `authenticated`, and server-only functions/service-role paths mediate access.

### Cleanup

No acceptance record persisted. After both runs the counts are:
- 1 profile and 1 auth user; the temporary manager is gone.
- 0 clients, leads, events, quotes, payments, communications, tasks, inquiry requests, rate-limit rows, Stripe webhook events and Storage objects.
- 17 audit rows: the original 11 plus the 6 written by the migration.

The only residue is that the `quotes.quote_number` identity advanced by two (`last_value = 2`), so the first real quote will be numbered 3.

### Preview → Supabase connection and real test inquiry

**Stable preview alias moved (owner approved):**
- `the-chef-catering-crm-preview.vercel.app` → `dpl_CpYLe299mnbvZiHSU79MFxZwyEAp`, the `the-chef-catering-crm` build of `feat/chef-revenue-launch-2026-11-06` @ `3416408`, built from root `the-chef-next`.
- The previous target was the September Phase 2 build `dpl_3mxAemATYTbkCBbre7KL4Q45zSAC`. To roll back: `vercel alias set <that deployment URL> the-chef-catering-crm-preview.vercel.app --scope wavysites-projects`.

**Turnstile regression on that Preview** (requests sent from the page origin; neither reached the database):

| Case | Response |
|---|---|
| Missing token | `503` "Please complete the spam protection check." This also proves `APP_ORIGIN` matches the alias and the Supabase/rate-limit server variables are present; otherwise the route returns 403 or "temporarily unavailable". |
| Invalid token | `400` "Spam protection expired. Please try again." (Cloudflare siteverify rejected it) |
| Valid token | `201`. The owner completed the check and pressed **Send My Event Request** on the redesigned Build My Event page. |

**Real inquiry (2026-11-08 18:19:36 UTC).** Test data: `chef-acceptance-20261108@example.invalid`, Jerk Chicken + Oxtail + Garden Salad, private chef, 40 guests, St. Louis 63101, peanut-allergy note.

- The success screen showed "Your request is in", including the not-reserved-until-deposit wording, and cleared the stored dish selection.
- Hosted data was created exactly as expected:
  - 1 client.
  - 1 `new_inquiry` lead with the date, guests, location, service, three `selected_menu_items`, the folded `menu_notes` and the dietary note.
  - `turnstile_token` and the honeypot field were **not** stored.
  - Package snapshot `Unsure`.
  - 1 "Respond to new catering inquiry" task.
  - 1 `inquiry_acknowledgment` communication plus outbox row, `queued` with 0 attempts. Nothing was sent; no email provider is configured.
  - 1 stored request, 2 rate-limit rows, 4 audit rows.
- **Event and menu from the real lead** (verified in a rolled-back conversion):
  - The event takes the lead's event type and package; the CRM convert action copies the requested date and guest count.
  - The event menu snapshot **and** the event menu workspace contain all three dishes.
  - The allergy note reaches `event_menus.allergy_notes`.
  - 6 default tasks are created and the workspace starts in `draft`.

**Cleanup (permanent, owner-requested):**
- A single guarded transaction deleted exactly that client, lead, task, communication and outbox row, the stored request, the 2 rate-limit rows, and the related audit rows (the inserts plus the delete records).
- Post-check: 0 clients, leads, events, tasks, communications, outbox rows, inquiry requests and rate-limit rows; 17 audit rows (11 original + 6 from the migration); 1 profile; 1 auth user; 0 Storage objects.

### Hosted Phase 3 UI acceptance — provider-independent

The Phase 3 branch was CLI-deployed to a protected Vercel Preview, deployment `dpl_7eUiMmZJHUzieMcfoKbR7ktH7Vv9` (`the-chef-catering-lr6kyggk0-wavysites.vercel.app`, 2026-11-08 13:39 local). The stable **Preview-only** alias was then temporarily moved to it:

- `https://the-chef-catering-crm-preview.vercel.app`
- `target=preview`; `productionUrl=null`
- Vercel Authentication remains enabled.
- No production domain was changed or promoted.

> **Alias restored 2026-11-08 ~13:50 local:** the owner's standing instruction is that the stable alias serves the verified public-launch build. It was moved back to `dpl_CpYLe299mnbvZiHSU79MFxZwyEAp` (`feat/chef-revenue-launch-2026-11-06` @ `3416408`). Phase 3 CRM acceptance now uses its **own** preview URLs: the deployment URL above, or the branch preview created when `feat/catering-crm-revenue-ops` is pushed. Do not point the stable alias at Phase 3 until the owner approves it.

The existing owner session persisted on the stable Preview origin. The following journey was exercised in the browser against hosted Supabase:

1. Submitted the actual public catering form with Turnstile and a synthetic `.test` address; the success state appeared only after the backend transaction.
2. Verified client and lead creation, persisted inquiry details, queued acknowledgment, lead detail, stage changes, required lost reason, restoration to Contacted, and activity history.
3. Converted the lead to an event; verified the event/menu/task workspace, updated event notes, and confirmed persistence.
4. Updated client notes, archived the client, restored it to Active, and verified both audit entries.
5. Created a quote and found a real runtime defect: PostgREST could not infer the intended `quotes` → `quote_versions` relationship because `quotes.current_version_id` creates a second relationship. The detail page returned "Unable to load this view."
6. Fixed the query with explicit `quotes_client_id_fkey` and `quote_versions_quote_id_fkey` relationship hints, reran typecheck/lint/tests, redeployed, and confirmed the same hosted quote loaded.
7. Added a $1,200 line item and verified database totals and the required $300 deposit.
8. Issued a secure proposal without queuing an email, opened the opaque client link, and recorded typed-name plus explicit-consent electronic acceptance.
9. Verified the revenue dashboard changed to $1,200 Approved and $1,200 Outstanding with one event Awaiting Deposit.
10. Recorded a temporary $300 manual deposit with an audit note. The append-only ledger persisted it, financial state changed to Booked, remaining balance became $900, and the booking-confirmation automation was queued for operator approval rather than sent.
11. Verified Communications showed approval-gated quote follow-up and booking confirmation actions and a queued, unsent inquiry acknowledgment. No real email was sent.
12. Refreshed the authenticated CRM and confirmed the owner session and data persisted.
13. Regressed the public Catering and Music/Entertainment experiences on the same Preview. Both branded sides, menus, inquiry links, music section, tracks, shows, and contact links remained present; no CRM integration appeared on the Music side.

No Stripe, Resend, or AI credential was used. The Checkout control remains at its explicit provider boundary.

**Acceptance cleanup:** a guarded transaction removed the synthetic client, lead, event, menus, tasks, quote/version/line item, agreement/version/evidence, proposal token/access events, financial ledger transaction, communications/outbox, scheduled actions, request/rate-limit rows, and acceptance audit rows. The post-check returned zero clients, leads, events, quotes, payments, communications, proposal tokens, scheduled actions, and outbox rows. The temporary proposal URL is therefore no longer usable.

### Still required before HOSTED PASSED

1. ~~Apply the hardening migration and re-run E1, E4 and F1–F4~~: **done** (2026-11-08, all pass).
2. ~~Preview connection and real test inquiry~~: **done** (2026-11-08, see above).
3. ~~Deploy and exercise Phase 3 quotes, secure proposals, electronic acceptance, the ledger, revenue dashboard, communications, and cleanup~~: **done** on the protected Preview.
4. Stripe test mode, Resend and AI Gateway acceptance: provider credentials and owner decisions remain outstanding (sections below).

## Preview/provider configuration status

Vercel project `wavysites/the-chef-catering-crm` has the Phase 1.5 Supabase, intake, origin, and Turnstile variables in **Preview**. It does not currently list the Phase 3 provider variables below. The next required boundary is Stripe TEST MODE.

### Stripe TEST MODE

Required in Vercel Preview only:

- `STRIPE_SECRET_KEY` — must start with `sk_test_`.
- `STRIPE_WEBHOOK_SECRET` — signing secret for `https://<preview-host>/api/stripe/webhook`.

Create the webhook for `checkout.session.completed` and `checkout.session.expired`. Do not configure live keys, create live charges, or add a custom Checkout domain.

### Resend Free

Required in Vercel Preview only:

- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO_EMAIL`
- `CRON_SECRET` (a new random server-only value)

The owner must first provide the Chef-owned domain/subdomain and desired From/Reply-To addresses, then add the DNS records supplied by Resend. No acceptance message may be sent to a real customer.

### Vercel AI Gateway

Required after the core revenue workflow passes:

- `AI_GATEWAY_MODEL`
- Deployment OIDC, or `AI_GATEWAY_API_KEY` for local testing only.

Keep the approved project budget at or below $5/month. AI remains lower priority and draft-only.

## Hosted acceptance still required

The provider-independent hosted work is complete. The following provider-backed items are **not yet claimed as hosted-passed**:

- Stripe test Checkout, successful test payment, verified signed webhook, duplicate webhook, ledger and booking state.
- Resend provider submission/delivery/failure/idempotency using an explicitly approved non-customer recipient.
- AI Gateway draft-only acceptance, if the optional final increment is pursued after revenue delivery.
- Final cleanup of any Stripe test objects and provider test-email artifacts created during those increments.

## Intentionally deferred

- Stripe live mode and live charges.
- Production-domain changes or promotion.
- Real-customer acceptance email.
- Certified third-party e-signature provider equivalence.
- Automatic AI sending or commercial-state mutation.
- Invoicing, SMS, payroll/staff scheduling, and Phase 4 work.

## Files changed in the Phase 3 checkpoint

### Configuration and documentation

- `.env.example`
- `next.config.mjs`
- `package.json`
- `package-lock.json`
- `docs/SETUP.md`
- `docs/PHASE3-IMPLEMENTATION.md`
- `docs/PHASE3-REPORT.md`

### CRM and public workflow

- `app/crm/actions.ts`
- `app/crm/crm.css`
- `app/crm/(protected)/layout.tsx`
- `app/crm/(protected)/leads/[id]/page.tsx`
- `app/crm/(protected)/events/[id]/page.tsx`
- `app/crm/(protected)/quotes/**`
- `app/crm/(protected)/communications/**`
- `app/crm/(protected)/revenue/**`
- `app/crm/(protected)/assistant/**`
- `app/proposal/**`
- `app/payment/**`
- `app/api/stripe/**`
- `app/api/resend/**`
- `app/api/internal/**`

### Server libraries, database, and tests

- `lib/crm/domain.ts`
- `lib/email/provider.ts`
- `lib/email/templates.ts`
- `lib/payments/**`
- `lib/security/**`
- `lib/supabase/service.ts`
- canonical Phase 1/2 migration filename reconciliation described above
- `supabase/migrations/20260911210739_catering_revenue_operations.sql`
- `supabase/migrations/20261108165321_phase3_revenue_hardening.sql`
- `supabase/migrations/20261108183134_phase3_fk_indexes.sql`
- `tests/database.test.ts`

The unrelated `Claude outputs/` directory is outside the nested application and was not modified.

## Acceptance decision

**Phase 3 is not yet fully accepted.** Local implementation, hosted Supabase, and provider-independent Preview acceptance are green. Work stops here at the required **Stripe TEST MODE** account/credential boundary. After Stripe passes, the next boundaries are Resend and then optional AI Gateway. Phase 4 has not begun.
