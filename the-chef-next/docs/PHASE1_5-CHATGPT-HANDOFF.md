# The Chef Catering CRM — Phase 1.5 Handoff

Prepared: 2026-09-09

Status: **Partial hosted acceptance pass; final acceptance is still blocked. Do not begin Phase 2.**

## Scope and safety boundaries

The CRM integrates only with The Chef's Catering experience. The Entertainment/Music experience, public branding, shared visual design, and production domain were not changed during Phase 1.5.

Only the dedicated Supabase project below was modified:

| Field | Value |
|---|---|
| Organization | Wavy Sites LLC |
| Project | `the-chef-catering-crm` |
| Project reference | `pqfyhkehbwikeaongcdo` |
| Region | `us-east-1` |
| Last verified project status | `ACTIVE_HEALTHY` |

Vertical Ops CRM, DayKare, and wavy crm were not modified. DayKare had already been intentionally paused by the user before the Chef project was created and must remain recoverable.

## Repository state

- Workspace: `C:\Users\fredd\Claude\Projects\The Chef\the-chef-next`
- Branch: `feat/catering-crm-foundation`
- Phase 1 baseline commits:
  - `195b79c` — preserve verified website dependency baseline
  - `91b7486` — database, Auth boundaries, and RLS foundation
  - `0204d06` — Catering intake and CRM lead/client/event workspaces
  - `f626933` — initial Phase 1.5 access report
- Framework/dependency baseline is frozen at Next.js 15.5.25 and React 18. No framework or dependency changes were made in Phase 1.5.
- Current tracked working-tree changes are documentation only: `docs/PHASE1_5-REPORT.md` plus this handoff.
- An ignored `.env.local` was created with only the project URL, publishable key, local origin, and `ALLOW_LOCAL_INQUIRIES=false`. It contains no server secret or password.

## Database migration deployment

The existing Phase 1 migration was applied unchanged to the dedicated hosted project:

- Local migration: `supabase/migrations/20260909164345_catering_foundation.sql`
- Local SHA256: `49BE43AC0277828E9091AE88DEADB5A1499B3D987A107FCDE4C59020BCB830DB`
- Hosted migration record: `20260909200419_catering_foundation`
- Deployment result: success

The connector assigned a different migration timestamp from the local filename. Reconcile the hosted version and local filename before a future Supabase CLI `db push`; otherwise the same DDL may be attempted again. Do not reset the hosted database.

Hosted catalog verification confirmed:

- Public tables: `profiles`, `clients`, `leads`, `events`, `activity_log`
- Private tables: `crm_private.inquiry_requests`, `crm_private.rate_limits`
- RLS enabled on all seven tables
- All 14 expected primary, unique, and secondary indexes present
- Expected public and Storage policies present
- Private buckets `crm-documents` and `crm-client-uploads` exist with `public=false`
- Anonymous and authenticated roles cannot execute `submit_catering_inquiry`
- `service_role` can execute `submit_catering_inquiry`
- Authenticated users cannot insert, update, or delete `activity_log`

The hosted security advisor returned two informational findings because the two private tables have RLS enabled without policies. This is intentional: the private schema is unavailable to client roles and these tables are service-role-only.

## Owner Auth provisioning

- Owner email: `thechefcs@gmail.com`
- The user entered the password directly in Supabase. The password was never shared, displayed, printed, or committed.
- The Auth user is email-confirmed.
- The existing secure UUID bootstrap was executed in one trusted transaction using `supabase/seed.sql`.
- Exactly one active CRM owner profile was verified: `Chef Frankie`, role `owner`, active `true`.
- Public Auth signup was disabled and read back as disabled.
- Anonymous sign-in was already disabled.
- Email/password is the enabled owner login method.
- There is no public registration route that grants CRM access.

An isolated unprovisioned Auth test user was created with a random, non-persisted password. It successfully authenticated through the actual local production build but was redirected to `/crm/login?error=access`. The test user was deleted afterward, and its absence was verified.

Owner login, logout, session refresh/persistence, and authenticated CRM browser navigation have not yet been completed. A clean owner login form is available at `http://127.0.0.1:3110/crm/login`; the owner must enter the password directly.

## Hosted intake and CRM workflow results

The hosted PostgreSQL intake function was exercised with isolated acceptance records.

- First package inquiry created one client and one lead.
- Replaying the same request UUID and payload created no duplicate lead.
- A later inquiry using the same normalized email reused the client and created a second lead.
- Returning-client matching retained the original first name and phone instead of overwriting them.
- Package choice, event type, requested date, guest count, custom menu request, and dietary notes persisted correctly.
- Three distinct submissions using the same email rate-limit key succeeded.
- The fourth submission failed with PostgreSQL code `P0003: Too many inquiries`.
- Owner-context RLS returned the acceptance CRM rows and `is_operator=true`.
- An unprovisioned authenticated UUID returned zero profiles, clients, leads, events, and audit rows with `is_operator=false`.
- One lead was moved to `lost` with a required reason.
- Another lead converted to an event.
- The database populated the menu/package snapshots from the lead.
- The event was edited to `booked`, 88 guests, with an internal acceptance note.
- Client notes and archive/unarchive changes persisted.
- Eight relevant audit entries were verified after the workflow.
- An attempted forged audit insertion failed with PostgreSQL `42501 permission denied`.

The hosted acceptance records intentionally remain so the owner can inspect dashboard, list, and detail views. They use `example.invalid` acceptance addresses. Remove them after the authenticated browser suite is complete.

These tests exercised the real hosted database function directly. They do not yet prove the public Next.js HTTP route and browser form work with the hosted service.

## Storage results

Hosted Storage RLS policy evaluation was tested:

- Owner context could insert and select a test object record in `crm-documents`.
- An unprovisioned authenticated identity could not see it.
- Anonymous context could not see it.
- Both buckets remain private.
- The temporary policy probe was removed through the Supabase Storage interface, and zero remaining probe records were verified.

This was a policy/metadata test rather than a real byte upload and download through the Storage HTTP API. Final acceptance still requires an actual temporary PDF or image upload, owner retrieval, anonymous and unauthorized retrieval denial, confirmation that no public URL works, and cleanup.

## Application verification completed

| Check | Result |
|---|---|
| Production build | Pass — Next.js 15.5.25 |
| Typecheck | Pass |
| Lint | Pass — 0 warnings and 0 errors after removing the unused `CATERING_PHONE_DISPLAY` import |
| Automated tests | 16 passed, 1 skipped |
| Dependency audit | Zero vulnerabilities |
| Unprovisioned browser login | Pass — redirected to `?error=access` |

The skipped test is the optional no-credentials HTTP suite. It was not relevant to the currently configured hosted project build. The complete suite must be rerun after the remaining hosted configuration is added.

## Secret handling status

No password, Supabase secret key, Turnstile secret, or rate-limit secret was committed or printed.

The Supabase secret key is visible to the authenticated administrator in the Chef project's API Keys page. The in-app browser clipboard is isolated and could not securely transfer it to the local server process. The administrator must place the following directly in the ignored local `.env.local` file without sending the values through chat:

```dotenv
SUPABASE_SECRET_KEY=<Chef project secret key>
INQUIRY_RATE_LIMIT_SECRET=<new long random value>
```

Do not use a key from another Supabase project. Do not put either value in a `NEXT_PUBLIC_` variable.

## Turnstile blocker

Cloudflare Turnstile is not configured, so valid-token production acceptance cannot run yet.

In Cloudflare:

1. Open Turnstile and add a widget named `The Chef Catering Preview`.
2. Use Managed mode.
3. Add the exact future Vercel preview hostname. Add localhost only if local real-widget testing is desired.
4. Put the site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
5. Put the secret only in server-side `TURNSTILE_SECRET_KEY`.

Production mode must reject missing and invalid tokens. `ALLOW_LOCAL_INQUIRIES=true` is only a non-production convenience and does not count as hosted Turnstile acceptance.

## Vercel preview blocker

No Vercel preview has been created or configured, and the production domain remains unchanged. Final preview acceptance requires:

- Identify or create the correct Chef Vercel project/team.
- Keep the project root as `the-chef-next`.
- Install command: `npm ci`.
- Build command: `npm run build`.
- Configure Preview-only environment variables from `.env.example`.
- Set `APP_ORIGIN` to the exact stable preview origin with no trailing slash.
- Allow that hostname in Turnstile.
- Do not promote or point the production domain at the unfinished CRM.

## Exact continuation order

1. Complete owner sign-in at `http://127.0.0.1:3110/crm/login` by entering the password directly.
2. Browser-test `/crm`, dashboard, leads, lead detail, stage changes, lost reason, clients, client detail, notes, archive/unarchive, event conversion, event list/editing, and audit timeline.
3. Refresh pages and sign out/sign back in to verify persistence and session behavior.
4. Configure `SUPABASE_SECRET_KEY` and `INQUIRY_RATE_LIMIT_SECRET` locally through a secure channel.
5. Exercise the actual public Catering inquiry form against the hosted backend, including idempotency, returning client matching, package/custom menu fields, validation, success timing, and HTTP throttling.
6. Perform the real Storage HTTP acceptance test and remove its file afterward.
7. Configure Turnstile and verify valid, invalid, and missing token behavior in production mode.
8. Configure and deploy a Vercel preview without changing the production domain.
9. Run public Catering and Music/Entertainment browser regressions against the preview.
10. Rerun build, typecheck, lint, automated tests, and dependency audit.
11. Remove remaining hosted acceptance client/lead/event records.
12. Update `docs/PHASE1_5-REPORT.md` with final evidence and mark Phase 1.5 passed only if every hosted acceptance item actually passes.
13. Stop and report to the user before beginning Phase 2.

## Files created or changed during the current hosted work

- `docs/PHASE1_5-REPORT.md` — updated hosted evidence and blockers.
- `docs/PHASE1_5-CHATGPT-HANDOFF.md` — this standalone handoff.
- `.env.local` — ignored local configuration containing public project configuration only; no server secret or password.

No application source, migration SQL, dependency, framework, Catering design, or Music/Entertainment file was changed during this hosted checkpoint.
