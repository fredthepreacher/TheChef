# Phase 1.5 — Hosted Integration & Acceptance Report

**Final status:** PASS

**Acceptance date:** September 11, 2026

**Phase 2:** Not started

Phase 1.5 was exercised against the dedicated hosted Supabase project and a Vercel Preview deployment. The public Catering intake, private CRM, Auth, RLS, Storage, audit protections, Turnstile, and the existing Catering and Music/Entertainment experiences passed their required acceptance checks. All temporary hosted acceptance records and files were removed afterward.

## Environment status

| Service | Accepted configuration |
|---|---|
| Supabase organization | Wavy Sites LLC |
| Supabase project | `the-chef-catering-crm` |
| Project reference | `pqfyhkehbwikeaongcdo` |
| Region | `us-east-1` |
| Project status | Active and healthy |
| Vercel project | `the-chef-catering-crm` |
| Vercel team | `wavysites-projects` |
| Stable Preview URL | `https://the-chef-catering-crm-preview.vercel.app` |
| Production domain | Not changed or promoted |

Only the dedicated Chef project was used. Vertical Ops CRM, DayKare, and wavy crm were not modified during this work.

The Preview environment contains the Supabase URL, publishable key, server-only Supabase secret key, application origin, rate-limit secret, Turnstile site key, and server-only Turnstile secret. Real values are not present in source control or this report. `.env.example` documents every application-owned variable. `NODE_ENV` and `VERCEL` remain platform supplied.

The browser client uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Privileged Supabase and Turnstile credentials are read by server-only code. A literal-value scan of the built client assets found no server credentials.

## Migration results

The existing Phase 1 catering foundation migration was applied to hosted Supabase through migration tooling. Tables were not manually recreated in the dashboard.

Verified hosted objects:

- Public tables: `profiles`, `clients`, `leads`, `events`, and `activity_log`.
- Private tables: `crm_private.inquiry_requests` and `crm_private.rate_limits`.
- All 14 expected primary, unique, and secondary indexes.
- All expected public and Storage policies.
- Private Storage buckets `crm-documents` and `crm-client-uploads`, both with `public=false`.
- RLS enabled on all seven application tables.

The migration contents deployed without a behavioral discrepancy from the PGlite foundation tests. Hosted migration history assigned version `20260909200419_catering_foundation`, while the local filename is `20260909164345_catering_foundation.sql`. This timestamp mismatch must be reconciled before a future Supabase CLI `db push` so the same DDL is not attempted twice. No database reset is needed.

Supabase's security advisor reported two informational notices for the two private tables because RLS is enabled with no client policies. That is intentional: these tables are service-role-only implementation state.

## Authentication results

The initial owner was securely provisioned for `thechefcs@gmail.com` and mapped to one active `profiles` row with owner role. The password was entered directly by the owner and was never requested, displayed, persisted, or committed by the acceptance process.

Verified in the real application:

- Owner email/password login succeeds.
- `/crm` redirects unauthenticated visitors to `/crm/login`.
- An authenticated but unprovisioned test user is denied and redirected to `/crm/login?error=access`.
- Inactive or unprovisioned profiles cannot access CRM data.
- Public signup is disabled, and there is no public registration route that grants CRM access.
- Refresh preserves the authenticated session.
- Logout invalidates the application session and returns to login.
- Signing back in restores access, and prior database changes persist.

The temporary unprovisioned Auth user was deleted and its absence was verified.

## RLS and audit results

The owner JWT returned `is_operator=true` and could read the accepted CRM rows. An unprovisioned authenticated identity returned `is_operator=false` and zero profiles, clients, leads, events, and audit rows. Anonymous access to private CRM data was denied.

Runtime checks covered owner access, anonymous denial, authenticated unprovisioned denial, and the private service-only intake state. An authenticated attempt to forge an `activity_log` row failed with PostgreSQL error `42501 permission denied`. Legitimate lead, client, and event changes generated audit entries, and those entries survived refresh and re-login.

## Authenticated CRM browser acceptance

The owner exercised the hosted database through the local production application and verified:

- Dashboard metrics and action-required records.
- Lead list and lead detail.
- Lead stage changes.
- Marking a lead lost with a reason.
- Client list and client detail.
- Client notes.
- Archive and unarchive.
- Lead-to-event conversion.
- Event list and event editing, including booked status and guest count.
- Audit timeline entries for the accepted changes.
- Persistence after page refresh, logout, and re-login.

The CRM remained private and noindex. Administrative data was not exposed through public routes.

## Public Catering intake results

The hosted intake database function and the actual Next.js HTTP route were both exercised.

Database-level acceptance verified:

- A new inquiry creates the correct client and lead.
- A returning customer is matched by normalized email.
- Replaying the same request UUID is idempotent and does not create a duplicate lead.
- A distinct inquiry from the same returning customer creates a new lead linked to the existing client.
- Package, event type, requested date, guest count, contact details, service style, venue details, COI requirement, budget, custom menu, dietary notes, and inquiry notes persist.
- Three inquiries within the configured email window succeed and the fourth is throttled.
- Invalid payloads return safe, understandable validation errors.
- The UI shows success only after the backend transaction completes.

The final Vercel Preview form submission used the real public page at `/catering/inquiry`. The Turnstile widget completed successfully, the form displayed the backend receipt confirmation, and hosted Supabase contained exactly one matching client and one matching lead with the submitted package, custom menu, guest count, date, venue, COI, contact, budget, dietary, and service details. Two audit entries were present for that transaction.

## Turnstile results

Local production-mode acceptance used Cloudflare's official test keys because Cloudflare would not cleanly create a production widget for `localhost`. The application contains a narrow local-only compatibility path for Cloudflare's documented always-pass test hostname/action values; it activates only for the published test secret and a `localhost` or `127.0.0.1` origin. Real preview verification remains strict.

The Vercel Preview uses a real Cloudflare Turnstile widget configured for `the-chef-catering-crm-preview.vercel.app`:

- Valid real widget token: PASS. The widget reported success and the backend accepted the inquiry.
- Missing token: PASS. The route returned HTTP 503 with a spam-protection prompt and created no record.
- Invalid token: PASS. The route returned HTTP 400 with an expired-token prompt and created no record.
- The Turnstile secret remains server-side and was not exposed in browser assets or logs.

Cloudflare keys are obtained from **Cloudflare Dashboard → Turnstile → Add widget**. Add the exact Preview hostname, create the widget, and place the public site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Place the secret in server-only `TURNSTILE_SECRET_KEY`. For local development these belong in ignored `.env.local`; for hosted acceptance they belong in Vercel's **Preview** environment. Rebuild/redeploy after changing the public site key.

## Storage results

A temporary document was uploaded through the real Supabase Storage HTTP API to the private `crm-documents` bucket.

- Owner upload: PASS.
- Owner authenticated download: PASS; downloaded bytes matched the upload.
- Unprovisioned authenticated retrieval: denied.
- Anonymous retrieval: denied.
- Public object URL: not accessible.
- Bucket configuration: private.
- Cleanup: test object removed through the Storage API and absence verified.

Storage metadata RLS was also checked under owner, unprovisioned, and anonymous identities.

## Deployment Preview and browser regressions

The accepted stable Preview is:

`https://the-chef-catering-crm-preview.vercel.app`

The latest accepted deployment was `https://the-chef-catering-kaiqwk9a0-wavysites-projects.vercel.app` and the stable Preview alias points to it. Preview environment variables are separate from Production.

The first Vercel deployment unexpectedly received the new project's default production alias even though the deployment command did not include `--prod`. No existing Chef production domain was connected, changed, or promoted. Subsequent acceptance used Preview only.

Catering regression checks passed on the deployed Preview: the branded home experience, story, menu/package links, gallery, reviews, and inquiry CTAs rendered and navigated correctly.

Music/Entertainment regression checks also passed: the split-view selector switched to Music, and the music navigation, artist story, featured mixtape, tracks, shows, and contact content rendered independently from the Catering CRM. No CRM functionality was added to the Music side.

No application-originated browser console errors were observed. Cloudflare's cross-origin Turnstile iframe emitted its own numeric console messages; they did not affect widget or form behavior.

## Final build and test results

| Check | Result |
|---|---|
| Production build | PASS — Next.js 15.5.25 |
| Typecheck | PASS |
| Lint | PASS — 0 warnings and 0 errors |
| Automated tests | PASS — 16 passed, 0 failed, 1 optional no-credentials HTTP test skipped |
| Dependency audit | PASS — 0 vulnerabilities |
| Catering browser regression | PASS on Vercel Preview |
| Music/Entertainment browser regression | PASS on Vercel Preview |
| Framework/dependency freeze | PASS — no package or lockfile changes |
| Client secret scan | PASS — no server-secret matches in `.next/static` |

The skipped automated test is the optional production HTTP boundary test that runs only when its dedicated credentials are supplied to that test process. The equivalent missing-token, invalid-token, real valid-token, hosted intake, Auth, RLS, and browser boundaries were exercised directly during this acceptance phase.

## Cleanup evidence

Acceptance cleanup removed 8 temporary clients, 14 leads, 2 events, 33 related audit entries, 14 private inquiry-request records, all acceptance rate-limit counters, the temporary Storage object and placeholder, and the temporary unprovisioned Auth user.

A final hosted query returned zero for Phase 1.5 clients, leads, events, inquiry requests, rate-limit rows, test Auth users, acceptance Storage objects, and audit metadata containing the Phase 1.5 marker. The real owner account was preserved.

## Files changed

- `.gitignore` — ignores local Vercel project metadata generated by `vercel link`.
- `app/api/catering/inquiries/route.ts` — adds the exact Cloudflare official test-key compatibility check for local production-mode acceptance while keeping real hosted validation strict.
- `docs/PHASE1_5-REPORT.md` — records final hosted acceptance evidence.
- `docs/PHASE1_5-CHATGPT-HANDOFF.md` — earlier handoff record requested for transfer to ChatGPT.
- `.env.local` — ignored local-only configuration; contains no committed values.
- `.vercel/project.json` — ignored local-only link to the dedicated Vercel project.

No dependency, framework, schema, branding, Catering UI, or Music/Entertainment source files changed in Phase 1.5. Temporary request fixtures used for missing/invalid-token checks were deleted.

## Unresolved issues and future setup

- Reconcile the hosted/local migration timestamp before a future Supabase CLI `db push`.
- Production deployment remains intentionally unconfigured. Before production launch, add the production hostname to the real Turnstile widget, configure the same required variables in Vercel's Production environment, deploy intentionally, and rerun the production-origin smoke tests.

No additional credential or external-service input is required to close Phase 1.5. The owner must continue to retain and rotate the Supabase, rate-limit, Turnstile, and Vercel secrets through their respective dashboards; none belongs in source control.

Phase 1.5 is accepted. Work must stop here for review before Phase 2 begins.
