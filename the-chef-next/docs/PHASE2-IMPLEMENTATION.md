# Phase 2 — Catering Operations Implementation Plan

## Starting point

Phase 2 starts from accepted commit `a6de1484abaa1a3c3cb240cdd00df4b9eaae5982` on branch `feat/catering-crm-operations`.

The application remains Next.js 15 App Router with React 18, TypeScript, Server Components, Server Actions, Supabase SSR cookie sessions, PostgreSQL RLS, protected audit triggers, and private Supabase Storage. The framework and dependency baseline will remain frozen unless a verified blocker requires a change.

The Catering boundary remains:

- Public catering intake: `/catering/inquiry` and `/api/catering/inquiries`.
- Private catering CRM: `/crm/**`.
- Music/Entertainment: existing public split-view and music components only. Phase 2 will not query, link to, or modify CRM data from this side.

Baseline inspection on September 11, 2026 passed production build, typecheck, lint with zero warnings/errors, and the existing automated suite with 16 passes and one credential-gated HTTP suite skipped.

## Database additions

One additive Phase 2 migration will be created with the installed Supabase CLI and committed under `supabase/migrations/`. It will preserve every Phase 1 table and function.

### Venues

Add a reusable `venues` table with:

- Name and structured address.
- Contact name, email, and phone.
- Loading instructions, kitchen availability, parking/loading notes, setup restrictions, and internal notes.
- Default COI requirement, additional-insured wording, insurance notes, and a default document lead time.
- Created/updated timestamps.

Events will receive a nullable `venue_id` plus a `venue_snapshot` JSON value. Linking or explicitly refreshing a venue copies the current venue details into the event snapshot. Later edits to a reusable venue will not silently rewrite an existing event's historical venue details.

### Event operations

Extend `events` with:

- Start/end time and service style.
- Venue relationship and historical venue snapshot.
- COI status, due date, venue requirements, additional-insured wording, and internal COI notes.
- Explicit guest-count confirmation and client-confirmation timestamps.
- A pointer to the current working menu revision.

COI states will be constrained to:

`not_required`, `requirement_unknown`, `required`, `requested`, `received`, `submitted_to_venue`, `approved`, and `rejected_needs_revision`.

COI approval remains an explicit operator action. File presence alone will never mark a COI approved.

### Menu revisions

Add `event_menus` as versioned working menus. Each revision stores structured fields for package/custom details, appetizers, entrées, seafood, sides, desserts, bread, dietary accommodations, allergies, substitutions, special requests, and internal preparation notes.

Statuses are `draft`, `client_review`, `revision_requested`, `approved`, and `locked`. Approval and lock timestamps are database constrained. A locked revision becomes immutable; further changes require creating a new revision. The original Phase 1 `events.menu_snapshot` and `package_snapshot` remain unchanged as the inquiry-time historical record.

Existing events will receive an initial working revision derived from their current menu snapshot. Newly created events will receive one automatically.

### Documents

Add `event_documents` metadata linked to an event and client. It will track:

- Category: COI, contract, venue requirements, menu, floor plan, event instructions, or other.
- Private bucket/path, original filename, MIME type, byte size, version, upload actor, notes, timestamps, replacement link, and active/superseded/archived state.

Files will stay in the private `crm-documents` bucket under an event-scoped path. Upload and authenticated retrieval will use the current operator's Supabase session so Storage RLS is exercised. Replacement retains old versions. Removing a document from the active event view will archive its metadata and retain history; cleanup of a failed upload may remove the orphaned object through a narrowly scoped operator delete policy.

### Tasks

Add a normalized `tasks` table that can link to an event, lead, and client. Fields include title, description, category, assignee, due time, status, priority, required flag, completion timestamp, notes, automation key, creator, and timestamps.

Categories:

`food_prep`, `purchasing`, `equipment`, `staffing`, `venue`, `insurance`, `client`, `transport`, `setup`, and `administrative`.

Statuses:

`todo`, `in_progress`, `blocked`, and `complete`.

New event workspaces will receive idempotent defaults for venue, guest count, menu/allergies, COI requirements, and client confirmation. Operators can edit these and create custom tasks. Inquiry intake will create one idempotent internal follow-up task.

### Communications and email outbox

Add an operator-readable `communications` timeline and a private `crm_private.email_outbox`.

The inquiry transaction will enqueue one branded acknowledgment communication/outbox item using a unique key derived from the inquiry request UUID. Replaying the same inquiry cannot enqueue another acknowledgment. Provider message IDs, attempts, delivery status, and safe errors will be retained when delivery is implemented.

No email provider is currently installed or configured. Phase 2 will add a typed provider interface and template/service layer without claiming delivery. Actual sending requires an approved provider, verified sending domain, API credential, and sender address. Those values will be server-only and documented only after the provider is selected.

## Security boundaries

- Every new public table receives RLS before Data API grants.
- Owner/manager authorization continues through `crm_private.is_operator()`; editable user metadata is never used.
- Authenticated grants remain column/table scoped, with matching `USING` and `WITH CHECK` policies for updates.
- Private helper/outbox tables remain outside the exposed schema and inaccessible to browser roles.
- Audit functions remain trigger-only; clients cannot insert, update, or delete history.
- Storage buckets remain private. No public URL is used for COI or event documents.
- Storage paths are event scoped; uploads are limited to the existing PDF/JPEG/PNG allowlist and 10 MB bucket limit.
- Service-role, email-provider, and other secrets remain server-only and are scanned out of client assets.
- Public registration stays disabled. CRM pages stay authenticated and noindex.

## Route and component additions

### CRM routes

- `/crm/venues` — reusable venue list and create form.
- `/crm/venues/[id]` — venue details/editing and linked events.
- `/crm/tasks` — cross-event operational task queue with status, priority, overdue, and event filters.
- `/crm/calendar` — month calendar and agenda/list view for catering events.
- `/crm/events/[id]` — expanded unified operations workspace.

The existing CRM navigation will add Venues, Tasks, and Calendar. No CRM link will be added to the public Music experience.

### Event workspace

The event page will be organized into scan-friendly sections:

- Overview and explicit confirmations.
- Readiness summary and blockers.
- Venue and COI.
- Working menu plus immutable original inquiry snapshots.
- Preparation tasks.
- Private documents and versions.
- Activity history.

Forms will continue using Server Actions for structured mutations. A small client component will handle direct private Storage upload/download so large files do not pass through a Vercel function body.

### Dashboard

The dashboard will answer “What needs Chef Frankie's attention today?” with:

- New/unanswered inquiries.
- Upcoming events.
- Events with readiness blockers.
- Unknown, overdue, or unapproved COI requirements.
- Menus awaiting approval.
- Overdue/blocked preparation tasks.
- Upcoming operational deadlines.

No quote, invoice, deposit, or payment state will be inferred. Payment will appear as an explicit “not tracked in Phase 2” placeholder and will be excluded from readiness scoring.

## Readiness model

Readiness will be calculated from stored facts rather than persisted as a potentially stale percentage.

Tracked checks:

- Venue details.
- Explicit guest-count confirmation.
- Current menu approval/lock state.
- COI requirement/status and deadline.
- Required COI document when applicable.
- Required task completion.
- Explicit client confirmation.

Missing or unknown required data counts as incomplete and is labeled clearly. Overdue requirements and blocked tasks produce blockers. Neutral items, including Phase 2's payment placeholder and documents with no stated requirement, are excluded from the denominator. The UI will show the component results alongside the percentage so the score is explainable.

## Calendar design

The internal calendar will use event date/time and query parameters for month and view. It will provide:

- Month grid with event links and compact readiness indicators.
- Agenda/list view with date/time, client, event type, venue, guest count, event status, and readiness.
- Previous/current/next month navigation.

The data model will support later external synchronization, but Phase 2 will not add Google Calendar.

## Audit coverage

The existing protected audit architecture will extend to venues, event menus, documents, tasks, communications, and readiness-relevant event fields. Important transitions will capture before/after state, including venue linking, COI status, menu status/approval/lock, task lifecycle, confirmation timestamps, and document version/archive metadata.

File bytes do not enter audit JSON. Activity displays will summarize relevant changes without exposing private URLs.

## Testing strategy

### Automated

- Execute the Phase 1 and Phase 2 migrations together in PGlite.
- Verify table constraints, foreign keys, version uniqueness, immutable locked menus, task completion timestamps, and COI status rules.
- Verify venue reuse and event snapshot preservation.
- Verify default task creation and idempotency.
- Verify readiness calculations for ready, incomplete, unknown, blocked, and overdue cases.
- Verify inquiry acknowledgment and follow-up-task idempotency.
- Verify operator RLS and anonymous/staff/unprovisioned denial for all new tables.
- Verify audit entries and audit-forgery denial.
- Verify private Storage insert/read/update/delete-cleanup policies.
- Preserve all Phase 1 validation, intake, snapshot, throttling, Auth, and route tests.

### Hosted acceptance

After local checks pass:

1. Apply the committed migration only to `pqfyhkehbwikeaongcdo`.
2. Run Supabase security and performance advisors.
3. Create temporary venue/event/menu/task/document data as the owner.
4. Verify unprovisioned and anonymous denial.
5. Exercise COI upload, authenticated retrieval, version replacement, archive history, and public denial.
6. Verify audit history and persistence after refresh/re-login.
7. Verify dashboard priorities and calendar/readiness behavior in a browser.
8. Verify the public inquiry creates one queued acknowledgment and one follow-up task without duplicates.
9. Remove temporary hosted acceptance data.

### Final regression

- Production build.
- Typecheck.
- Lint with zero warnings/errors.
- Complete automated tests.
- Dependency audit.
- Authenticated desktop/mobile CRM browser tests.
- Public Catering regression.
- Music/Entertainment regression.
- Server-secret scan of client assets.

## Implementation increments

1. Migration, constraints, RLS, audit triggers, backfill, and database tests.
2. Type-safe domain schemas, readiness calculator, and Server Actions.
3. Venue pages and event linking.
4. Menu revision and approval/lock workflow.
5. Task queue, default tasks, and readiness UI.
6. Private document/COI upload, retrieval, replacement, and archive workflow.
7. Calendar and operational dashboard.
8. Email template/provider abstraction plus transactional acknowledgment outbox.
9. Local full verification.
10. Hosted migration and acceptance, cleanup, and `docs/PHASE2-REPORT.md`.

## External-service boundary

Supabase and Vercel Preview are already available. Cloudflare Turnstile remains configured for the Preview intake.

Outbound email is the only known Phase 2 external dependency. The repository currently has no transactional email SDK, SMTP integration, verified sender domain, or provider credentials. The implementation will stop before provider delivery and report the exact provider setup required. It will never mark or report an acknowledgment as sent until a provider returns a successful delivery result.

Production deployment and production-domain changes are outside this phase.
