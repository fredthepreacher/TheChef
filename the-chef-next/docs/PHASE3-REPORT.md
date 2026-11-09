# Phase 3 Revenue Operations Report

**Status (updated 2026-11-08 ~19:45 local, ET):**
- Local verification passes at commit `e4f14ab`.
- Hosted database acceptance passes (39/39).
- The provider-independent **core** UI path passes: inquiry → lead → event → quote → proposal → acceptance → deposit-pending → ledger → revenue → communications (Codex run).
- **Hosted UI defects D-1 and D-2 are fixed and re-verified on hosted.**
  - D-1: a revision could never be issued.
  - D-2: a client could not send a revision request or decline that included a message.
  - With owner approval, migration `20261108212749_phase3_proposal_revision_fixes.sql` was applied at **00:08:48 UTC on 2026-11-09** (19:08:48 ET on 2026-11-08). The hosted UI journey then passed: revise with a message → issue v2 → decline with a message → issue v3 → accept → deposit-pending, plus the new Client responses panel. See "Hosted re-test of the D-1/D-2 fix" below.
- **Stripe test mode, Resend and AI Gateway are PENDING owner configuration.** They are not failed; credentials and decisions have not been supplied.
- Phase 3 is **NOT HOSTED PASSED**.  
**Account scope: second swap reversed.** The free slot was swapped twice on 2026-11-08, both times with owner approval. After the second window, `the-chef-catering-crm` was paused (INACTIVE 19:36:26 local) and `wavysites-web` was resumed (**ACTIVE_HEALTHY 19:41:04 local**). Wavy Sites was smoke-tested again: `GET /api/health` → `{"ok":true}` (200); one `/start` lead `SMOKE TEST 2 — Claude (please delete)` stored at 19:41:54 (`form=project`, `status=new`, no spam flags) with its alert email sent on attempt 1. `geos-ventures's Project` was never touched. Resume the Chef project, which needs a free slot, before the next hosted Phase 3 step.  
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
- `20261108191500_stripe_async_checkout_events.sql` — additive support for delayed-payment Checkout success/failure webhooks while retaining the existing signature, amount, currency, unknown-session, and duplicate-event gates.
- `20261108212749_phase3_proposal_revision_fixes.sql` — fixes D-1 and D-2. `prepare_and_issue_proposal` reuses the event's agreement and appends the next agreement version (it refuses if an agreement was already accepted). `respond_to_proposal_by_token` changes only the issued version's status and stores the client's message on `crm_private.proposal_access_events.message`. New operator-only `list_proposal_responses(quote_id)` (SECURITY DEFINER, `search_path=''`, `is_operator()` check, no `anon` grant) feeds a "Client responses" panel on the CRM quote page. **Applied to hosted 2026-11-09 00:08:48 UTC and re-verified there.**

The primary Phase 3 migration was previously applied to the Chef hosted project. It has not been edited in place since that hosted application. The hardening migration passed the local migration suite and was **applied to hosted on 2026-11-08 at 17:36:40 UTC**, after a dry-run confirmed it was the only pending migration and the owner explicitly approved the push. Later dry-runs showed only the new foreign-key-index migration and then only the Stripe asynchronous-event migration; each was applied alone. Local/remote history now matches across all seven canonical versions.

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

Re-run by Claude on 2026-11-08 at Codex's final state, committed unmodified as `e4f14ab`: typecheck pass, lint pass, `npm test` 27 passed / 1 credential-gated skip / 0 failed, Next.js 15.5.29 production build pass (16 routes), `npm audit` 0 vulnerabilities (prod and all), tracked-file secret scan clean. Earlier results:

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
| 14:38:57 | Paused `the-chef-catering-crm` from the dashboard (acceptance stopped cleanly; remaining work blocked on owner decisions) | `PAUSING` |
| 14:39:57 | — | Chef project **INACTIVE** |
| ~14:40 | Resumed `wavysites-web` from the dashboard | `COMING_UP` → `RESTORING` |
| 14:44:31 | — | `wavysites-web` **ACTIVE_HEALTHY** |
| 14:47:59 | Wavy Sites smoke test: `GET /api/health` → `{"ok":true}` (200); one `/start` lead `SMOKE TEST — Claude (please delete)` stored (`form=project`, `status=new`, no spam flags) and its alert email sent on attempt 1 | PASS |
| **Second window** (owner approved "Yes, apply it" for the D-1/D-2 fix) | | |
| ~19:02 | Paused `wavysites-web` from the dashboard | `PAUSING` (19:02:05) |
| 19:03:12 | — | `wavysites-web` **INACTIVE** |
| ~19:04 | Resumed `the-chef-catering-crm` from the dashboard | `COMING_UP` (19:04:28) |
| 19:08:07 | — | Chef project **ACTIVE_HEALTHY** |
| 19:08:48 | `npx supabase db push --linked --yes` applied `20261108212749` (dry run first listed only that file) | applied |
| 19:10–19:34 | Hosted UI re-test, Client responses panel check, guarded cleanup | PASS |
| ~19:35 | Paused `the-chef-catering-crm` from the dashboard | `PAUSING` (19:35:36) |
| 19:36:26 | — | Chef project **INACTIVE** |
| ~19:37 | Resumed `wavysites-web` from the dashboard | `COMING_UP` |
| 19:41:04 | — | `wavysites-web` **ACTIVE_HEALTHY** |
| after 19:41:04 | Wavy Sites smoke test: `GET /api/health` → `{"ok":true}` (200); one `/start` lead `SMOKE TEST 2 — Claude (please delete)` stored at 19:41:54 (`form=project`, `status=new`, no spam flags) with its alert email sent on attempt 1 | PASS |

No other project was touched. `wavy crm`, `wavy-rewards-staging`, `DayKare` and `Vertical Ops CRM` remain paused; `geos-ventures's Project` (separate client organization) remains active and untouched.

**Owner directions (two, recorded as given):**
- Codex recorded "keep the Chef project running on the existing Free configuration and do not modify `wavysites-web` or `geos-ventures's Project`".
- Claude was separately instructed: if the remaining hosted work cannot be completed because provider credentials or decisions are unavailable, stop cleanly, pause the Chef project, restore `wavysites-web`, confirm `ACTIVE_HEALTHY`, smoke-test the Wavy Sites lead form, and not leave Wavy Sites paused unnecessarily.

Claude followed the second instruction at 14:38–14:48 (rows above), because D-1/D-2 fixes and provider credentials both await owner decisions.

To continue hosted Phase 3 work, resume the Chef project. That needs a free slot: pause `wavysites-web` again, or approve a paid plan.

Wavy Sites had no database from 12:16 to 14:44 local, and again from 19:03 to 19:41:04 local. Any `/start` submissions in those windows failed.

### Migration state

- Hosted history matched the repo for `20260909200419`, `20260911194218`, `20260911194632` and `20260911210739`.
- `npx supabase db push --linked --dry-run` reported exactly one pending migration: `20261108165321_phase3_revenue_hardening.sql`.
- The first push attempt stopped at the tool-permission boundary. After explicit owner approval, `npx supabase db push --linked --yes` applied it at **17:36:40 UTC**. `npx supabase migration list --linked` now shows all five migrations matching local and remote.
- Before the hardening, hosted ran these definitions (verified from the hosted catalog). All three are fixed now:
  - `process_stripe_checkout_event` has only the 6-argument signature, with **no amount/currency verification**.
  - `crm_private.prepare_payment_transaction` does **not** require `recorded_by = auth.uid()`, so an operator could attribute a manual payment to another operator.
  - 5 automation rules exist, 0 are active, so no upcoming-event reminder is scheduled after booking.
- **2026-11-09 00:08:48 UTC:** after the dry run listed only `20261108212749_phase3_proposal_revision_fixes.sql`, it was applied with owner approval. `npx supabase migration list --linked` shows all **8** migrations matching local and remote. It wrote no data rows (audit count stayed at 17).
- What the hardening migration wrote to hosted data: 6 `activity_log` rows at 17:36:40 UTC with no user actor. Five existing lifecycle rules were activated, and `Upcoming event reminder` (`event_booked` → `draft_upcoming_event_reminder`) was inserted. All 6 rules are active, and **all 6 have `requires_operator_approval = true`**.

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

The Phase 3 branch was CLI-deployed to a protected Vercel Preview. After the final Stripe event hardening, the stable **Preview-only** alias was moved to deployment `dpl_6Wqq5yPmtX9NYzKPxEc96VvvY7Pe` (`the-chef-catering-j1adlnzr2-wavysites.vercel.app`):

- `https://the-chef-catering-crm-preview.vercel.app`
- `target=preview`; `productionUrl=null`
- Vercel Authentication remains enabled.
- No production domain was changed or promoted.

> **Stable alias timeline (true state):**
>
> | Time (local) | Target | By |
> |---|---|---|
> | 13:16 | `dpl_CpYLe299mnbvZiHSU79MFxZwyEAp`, launch branch `3416408`, owner-approved launch preview | Claude |
> | 13:40 | `dpl_7eUiMmZJHUzieMcfoKbR7ktH7Vv9`, Phase 3 CLI build | Codex |
> | 13:50 | back to `dpl_CpYLe299…`, per the owner's instruction to keep the launch preview | Claude |
> | 14:05 | `dpl_6Wqq5yPmtX9NYzKPxEc96VvvY7Pe`, Phase 3 CLI build with the Stripe async changes | Codex |
>
> **Current state:** the alias serves Codex's Phase 3 build. The owner has asked that the approved launch preview (`dpl_CpYLe299…`) be preserved and that the alias not be replaced without explicit approval. Restoring it is therefore an **open owner decision**. Phase 3's own preview is the branch alias `the-chef-catering-crm-git-feat-catering-crm-re-33e01d-wavysites.vercel.app` (`dpl_DY7nJfFpczG7Zm9MnCE1uN1AN7Le` @ `e4f14ab`).

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

Before stopping at that boundary, Stripe hardening was aligned with current Checkout guidance: the server accepts either a test secret key or a least-privilege restricted test key; the webhook route recognizes `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`; and hosted execution of the database processor remains service-role-only. A protected-Preview POST without `Stripe-Signature` returned the safe `Missing signature` rejection.

**Acceptance cleanup:** a guarded transaction removed the synthetic client, lead, event, menus, tasks, quote/version/line item, agreement/version/evidence, proposal token/access events, financial ledger transaction, communications/outbox, scheduled actions, request/rate-limit rows, and acceptance audit rows. The post-check returned zero clients, leads, events, quotes, payments, communications, proposal tokens, scheduled actions, and outbox rows. The temporary proposal URL is therefore no longer usable.

### Additional hosted UI acceptance: revisions, client responses, mobile/desktop (Claude, 14:17–14:42 local)

Codex's run covered the core path but not quote revisions, decline, request-revision, or phone layout. These were run on the committed code (`e4f14ab`) against hosted Supabase.

The owner's sign-in did not reach Supabase on the branch preview URL (`auth.users.last_sign_in_at` is still 2026-09-11). The journey therefore used the owner's existing session on the stable alias host, which serves Codex's Phase 3 build. The alias was **not** changed.

Test data:
- Lead `UI acceptance test (please ignore)`, created through the same `submit_catering_inquiry` RPC the public form uses.
- 60 guests; Wings, Oxtail and Banana Pudding; `chef-ui-acceptance-20261108@example.invalid`.

| Step | Result |
|---|---|
| Lead detail shows inquiry, dishes, queued acknowledgment, audit | PASS. Phase 3's lead page does not yet include the launch branch's improvements: dish list, location/dish summary, Clover deposit note. See integration note. |
| Lead → event conversion | PASS: 6 default tasks, draft working menu revision 1, audit rows |
| Quote creation from lead (quote #4 v1) | PASS. The event page's Quote section has no create button; the lead page does. |
| Line item + settings | PASS, database-calculated: 60 × $25.00 → subtotal $1,500.00, 7% tax $105.00, 18% service $270.00, total **$1,875.00**, 50% deposit **$937.50** |
| Lock and issue v1, email-queue checkbox off | PASS: one-time link warning shown, no email queued, quote follow-up scheduled as *Awaiting Approval* |
| Client proposal page | PASS: correct totals/terms/expiry, internal-note marker **not** shown, `noindex, nofollow, nocache` |
| Request revision **with** a message | **FAIL (D-2)**: page shows "This proposal could not be updated" (`?error=unavailable`) |
| Request revision with an empty message | PASS: "Your response has been recorded"; CRM shows *Revision Requested* with Create revision / Revoke client link |
| Create revision v2 + add dessert station | PASS: v2 draft copied v1. New totals: subtotal $1,650.00, tax $115.50, service $297.00, **$2,062.50**, deposit **$1,031.25** |
| Lock and issue **v2** | **FAIL (D-1)**: "Could not save" (`?error=issue`). The decline and approve-after-revision steps could not run as a result. |
| Revenue dashboard | PASS: renders; quoted/awaiting are $0 because v1 was revision-requested and v2 never issued; queued acknowledgment listed |
| Communications / outbox | PASS: 6 rules all approval-required; quote follow-up *Awaiting Approval*; acknowledgment *Queued*. "Send queued emails" was not pressed. |
| Mobile (390 px) and desktop | PASS: no horizontal overflow on `/crm`, lead, event, quote, revenue, communications or the proposal page; desktop quote page renders cleanly. The lead page has 3 small text links. |

**Defect D-1: revisions cannot be issued.**
- `public.prepare_and_issue_proposal` always runs `insert into public.agreements(event_id, …)`, but `agreements.event_id` is unique.
- Every issue after the first one for an event therefore fails.
- Reproduced in a rolled-back transaction: `23505 duplicate key value violates unique constraint`, with 1 existing agreement for the event.
- Suggested fix (additive migration): reuse the event's agreement and insert the next `agreement_versions` row (version + 1), superseding the previous version and pointing `current_version_id` at the new one.

**Defect D-2: a client message breaks revision requests and declines.**
- `public.respond_to_proposal_by_token` appends the message to the issued version's `client_notes`.
- `crm_private.prepare_quote_version` forbids any `client_notes` change on non-draft versions.
- Reproduced: `P0001 Issued quote versions are immutable`.
- Responses without a message succeed.
- Suggested fix (additive migration): store the client's message in `crm_private.proposal_access_events` (new nullable column) or a dedicated responses table instead of mutating the issued version. Then show it to the operator on the quote page.

**Fix status (2026-11-08, local only):** migration `20261108212749_phase3_proposal_revision_fixes.sql` implements both suggested fixes, and the CRM quote page shows a "Client responses" panel. Regression test `tests/proposal-revisions.test.ts` runs on the real migrations in PGlite:
- issue v1
- request revision **with a message**: the version notes stay unchanged, the message is stored, the lead moves to `awaiting_decision`
- create and issue **v2**: 1 agreement, versions superseded/sent, the old link rejected
- decline v2 **with a message**: the lead becomes `lost`, with the message as the lost reason
- create and issue v3, then accept it: `approved_deposit_pending`
- further revision refused after acceptance
- the response history is operator-only; unprovisioned and anonymous callers are refused

With the migration temporarily removed, the same test fails with the hosted error (`Issued quote versions are immutable`). Full suite at the fix: typecheck, lint, **28 passed / 1 credential-gated skip**, Next.js production build (16 routes), `npm audit` 0 vulnerabilities, secret scan clean.

### Hosted re-test of the D-1/D-2 fix (Claude, 2026-11-08 19:08–19:34 local)

**Post-apply checks (hosted catalog):**
- `crm_private.proposal_access_events.message` exists.
- `list_proposal_responses` is SECURITY DEFINER with `search_path=""`.
- Execute grants:
  - `anon` can execute **none** of `list_proposal_responses`, `respond_to_proposal_by_token` or `prepare_and_issue_proposal`.
  - `authenticated` can execute `list_proposal_responses` and `prepare_and_issue_proposal`, but **not** `respond_to_proposal_by_token`, which is service-role only.
- Advisors:
  - Security: 10 WARN `authenticated_security_definer_function_executable`. The only new one is `list_proposal_responses`, the same accepted pattern as the 9 existing operator RPCs (each checks `is_operator()`).
  - Security: 1 WARN `auth_leaked_password_protection` (unchanged).
  - Performance: no findings.

**UI journey.**
- **Setup:**
  - Test data: one labelled test lead (`UI revision re-test (please ignore)`, `chef-ui-acceptance-20261108b@example.invalid`), created through the same `submit_catering_inquiry` RPC the public form uses.
  - Host for operator and client steps: the stable alias, using the owner's existing session. It serves `dpl_6Wqq5…` (`39b4959`), and the fix is entirely in the database, so that build exercises it. The alias was **not** changed.
  - Panel step: run on the branch preview built from `9680a42` (`dpl_ADB7VW5R…`) after the owner signed in there.
- **Email:** the email-queue box was left unchecked on every issue, and no email provider is configured.

| Step | Result |
|---|---|
| Lead → event, quote #5 v1 (60 × $25.00 = **$1,500.00**, 25% deposit **$375.00**), lock and issue | PASS |
| Client: request revision **with a message** | **PASS (D-2 fixed)**: "Your response has been recorded"; quote shows *Revision Requested* |
| Create revision v2 (+ dessert station 60 × $2.50 → **$1,650.00**, deposit **$412.50**), lock and issue | **PASS (D-1 fixed)**: issued, status *Sent* |
| Old v1 link | PASS: 404, no accept/respond controls |
| Client: decline v2 **with a message** | **PASS (D-2 fixed)**: recorded; lead → *Lost* with lost reason = the client's message |
| Create revision v3, lock and issue (third issue on the same event) | PASS: *Sent* |
| Client: accept v3 (typed name + consent) | PASS: "Your electronic acceptance has been recorded" |
| CRM after acceptance | PASS: v3 *Approved*, no revise/revoke controls; event *Approved Deposit Pending*; lead `awaiting_deposit`; Revenue shows Quoted/Approved/Outstanding **$1,650.00**, 1 awaiting deposit |
| Database state | PASS: **1** agreement, versions `1:superseded, 2:superseded, 3:accepted`; `client_notes` on all issued versions unchanged (`''`); `event_financials.commercial_status = approved_deposit_pending` |
| `list_proposal_responses` as the owner identity | PASS: 3 rows: v1 revision requested and v2 declined, each with its message; v3 accepted with no message |
| **Client responses panel** (branch preview, `9680a42`) | PASS: lists v3 Accepted / "No message", v2 Declined with the quoted message, v1 Revision Requested with the quoted message, newest first |

**Re-test cleanup (permanent, guarded):**
- One transaction resolved every ID from the test client.
- It aborted on any unexpected state: more than one client, payment rows, AI or document rows, or Storage objects.
- It removed:
  - the client, lead and event, with the event's menu and tasks
  - quote #5, its 3 versions and its line items
  - the agreement, its 3 versions and the financial row
  - 3 proposal tokens and their access events
  - the scheduled actions
  - the queued acknowledgment communication and its outbox row (never sent)
  - the stored request, the rate-limit rows and the related audit rows
- Post-check: **0** rows in every CRM, revenue, proposal, scheduling, outbox, request and rate-limit table; **17** audit rows; 1 profile; 1 auth user; 0 Storage objects.
- The quote-number identity is now at 5, so the next real quote will be #6.
- The test proposal links stored in the browser were removed.

**Smaller observations (non-blocking):**
- The event readiness card still says "Deposit / payment: Not tracked in Phase 2".
- The communications header says "Rules begin disabled" while all six are enabled.
- The proposal page still shows Accept / Revise / Decline after a response has been recorded.
- After `checkout.session.async_payment_failed`, the payment request stays `open` until the next checkout cancels it. This is safe, but it could be marked `cancelled` for clarity.
- `APP_ORIGIN` is a single Preview value (the stable alias), so a proposal link generated on any other preview URL points at the stable alias host.
- When a later version is issued, the earlier version's status becomes `superseded`, which replaces `declined` or `revision_requested`. The client's response still survives in the access-event log, the Client responses panel and the lead's lost reason.
- Most CRM pages format times with `toLocaleString()` on the server, which renders **UTC** on Vercel. The Activity panel uses Eastern time with an "ET" suffix. The Client responses panel now matches Activity. The other pages are unchanged and should get one shared formatter once the owner confirms Chef's time zone.

**Cleanup (permanent, guarded):**
- One transaction removed exactly the test client, lead, event, working menu, 6 tasks, quote #4, v1/v2, 3 line items, agreement and version, proposal token and access events, scheduled action, communication and outbox row, stored request, 3 rate-limit rows (`ip:`/`email:` seed keys and one `proposal:` key), and the related audit rows.
- The post-check returned 0 for every CRM, revenue, proposal, scheduling, outbox, request and rate-limit table; 17 audit rows; 1 profile; 1 auth user; 0 Storage objects.
- The quote-number identity is now at 4, so the next real quote will be #5.

### Integration note: Phase 3 vs. the public-launch branch

`feat/catering-crm-revenue-ops` (Phase 3) and `feat/chef-revenue-launch-2026-11-06` (public launch) have diverged:
- The launch branch changed `app/crm/(protected)/leads/[id]/page.tsx`: dish list, location/dish summary, Clover deposit rule.
- The launch branch changed the intake: `selected_menu_items`, `event_location`, folded `menu_notes`.

Both run against the same hosted schema today. They must be merged and re-verified before either reaches `main`.

### Still required before HOSTED PASSED

1. ~~Apply the hardening migration and re-run E1, E4 and F1–F4~~: **done** (2026-11-08, all pass).
2. ~~Preview connection and real test inquiry~~: **done** (2026-11-08).
3. ~~Core provider-independent UI path~~: **done** (Codex run).
4. ~~Apply the D-1/D-2 fix to hosted and re-run the revision/response journey~~: **done** (2026-11-08 19:08–19:34 local, all pass).
5. **Stripe test mode**: PENDING owner configuration (test/restricted key + webhook secret in Preview only).
6. **Resend**: PENDING owner configuration (Chef-owned sending domain, From/Reply-To, DNS). Also requires the Chef new-inquiry notification below.
7. **AI Gateway**: PENDING (optional, draft-only, ≤ $5/month).
8. Owner decision on the stable alias (see timeline above).

## Preview/provider configuration status

Vercel project `wavysites/the-chef-catering-crm` has the Phase 1.5 Supabase, intake, origin, and Turnstile variables in **Preview**. It does not currently list the Phase 3 provider variables below. The next required boundary is Stripe TEST MODE.

### Stripe TEST MODE

Required in Vercel Preview only:

- `STRIPE_SECRET_KEY` — a least-privilege `rk_test_` key is preferred; an `sk_test_` key is also accepted. Never use a live key.
- `STRIPE_WEBHOOK_SECRET` — signing secret for `https://the-chef-catering-crm-preview.vercel.app/api/stripe/webhook`.

Create the test/sandbox webhook for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. Do not configure live keys, create live charges, or add a custom Checkout domain.

### Resend Free

Required in Vercel Preview only:

- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO_EMAIL`
- `CRON_SECRET` (a new random server-only value)

The owner must first provide the Chef-owned domain/subdomain and desired From/Reply-To addresses, then add the DNS records supplied by Resend. No acceptance message may be sent to a real customer.

**Launch requirement (owner, 2026-11-08). All three must pass for Resend acceptance:**
1. The customer receives the inquiry acknowledgment. Implemented: `inquiry_acknowledgment` is queued by the intake transaction.
2. **Chef receives an immediate new-inquiry notification.** **NOT IMPLEMENTED:** the only templates are `inquiry_acknowledgment`, `catering_proposal` and the approval-gated lifecycle drafts. A Chef notification template, a recipient setting (owner address) and enqueueing in the intake transaction are still needed.
   - **Update 2026-11-09 (Phase 3.5 integration, `feat/chef-production-integration` @ `c0b263c`): queuing is IMPLEMENTED; delivery is NOT yet accepted.**
     - Template `owner_inquiry_notification`.
     - Server-side recipient `CHEF_NOTIFICATION_EMAIL`.
     - Migration `20261109220000_owner_inquiry_notification`: a 6-argument `submit_catering_inquiry` overload that queues the alert in the same intake transaction, once per request.
     - Tests in `tests/owner-notification.test.ts`.
     - Still open for Resend acceptance:
       - the migration must be applied to the hosted database
       - the owner's address must be set
       - Resend must be configured
       - a send trigger is needed for the "immediate" part. Today queued mail only goes out via the CRM's "Send queued emails" or the `CRON_SECRET` endpoint, and Vercel Hobby crons run at most daily.
     - Not yet hosted-passed.
3. No real customer receives a test email. Acceptance must use provider-designated test recipients or an owner-approved non-customer address; the outbox "Send queued emails" action must not be run while real inquiries are queued.

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
- `supabase/migrations/20261108191500_stripe_async_checkout_events.sql`
- `supabase/migrations/20261108212749_phase3_proposal_revision_fixes.sql`
- `tests/database.test.ts`
- `tests/proposal-revisions.test.ts`
- `app/crm/(protected)/quotes/[id]/page.tsx` (Client responses panel)

The unrelated `Claude outputs/` directory is outside the nested application and was not modified.

## Acceptance decision

**Phase 3 is NOT HOSTED PASSED.**

Green:
- local verification at `e4f14ab`, and again at the fix commits
- hosted database acceptance
- preview → Supabase intake
- the core UI path
- the revision/decline/request-revision paths, after the D-1/D-2 fix was applied to hosted

Blocking:
- Stripe test mode, Resend (including the missing Chef new-inquiry notification) and AI Gateway are **pending owner configuration**, not failed.

Phase 4 has not begun. `main` and the production domain are untouched.
