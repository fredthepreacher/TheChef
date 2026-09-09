# Phase 1.5 — Hosted Integration & Acceptance

**Status: BLOCKED / NOT PASSED. Phase 2 has not begun.**

Baseline: `0204d0668c634a1d32a238b6e4d81ee756657258` on `feat/catering-crm-foundation`.
This report records the initial access check and local re-verification. It is not hosted acceptance sign-off.

## Environment and access

Supabase connector access was exercised successfully: project and organization listings returned. The only organization returned was **Wavy Sites LLC** (`hpieaqsnrcibdxxljyhx`). Projects returned were Vertical Ops CRM, wavy crm and DayKare. None is identified as a dedicated The Chef catering project. No unrelated project was modified.

The user was asked to select the organization for a new dedicated project (or supply an existing dedicated project reference), and provide the initial owner's email. These answers are pending. The Supabase creation tool requires organization selection, then a cost lookup and explicit cost confirmation before project creation. No costs have been assumed or approved.

Only `.env.example` exists locally; no `.env.local` or `.vercel` link was found. All seven required hosted configuration variables were absent from the execution environment. No real credentials were read, printed, written or committed in this phase.

## Configuration and secret boundaries

Source inspection confirms `.env.example` includes every application-supplied variable currently used by Phase 1:

| Variable | Placement |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Local `.env.local`; Vercel Preview environment for acceptance |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same; public/publishable key only |
| `SUPABASE_SECRET_KEY` | Server-only local/Vercel Preview secret |
| `APP_ORIGIN` | Exact local/preview origin without trailing slash |
| `INQUIRY_RATE_LIMIT_SECRET` | Random server-only local/Vercel Preview secret |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public widget key; available during build |
| `TURNSTILE_SECRET_KEY` | Server-only local/Vercel Preview secret |
| `ALLOW_LOCAL_INQUIRIES` | Optional local development convenience; production code ignores the bypass |

`NODE_ENV` and `VERCEL` are platform-supplied, not credentials. `TEST_BASE_URL` is an optional test-runner variable.

The browser Supabase helper uses only the URL and publishable key. The privileged intake helper imports `server-only` and is used by the server inquiry route. A fresh `.next/static` scan found no references to `SUPABASE_SECRET_KEY`, `TURNSTILE_SECRET_KEY`, or `INQUIRY_RATE_LIMIT_SECRET`. Because actual deployment credentials are absent, scanning the final configured deployment bundle for their literal values remains an acceptance step. Do not place a secret/service-role key in a publishable variable.

## Hosted acceptance matrix

| Area | Actual result |
|---|---|
| Dedicated Supabase environment | BLOCKED: organization/project selection and provisioning pending |
| Existing migration deployment | NOT RUN: no dedicated project selected |
| Hosted tables and indexes | NOT VERIFIED |
| Hosted RLS and policy behavior | NOT VERIFIED; local PGlite checks passed only |
| Hosted audit/history protections | NOT VERIFIED; local checks passed only |
| Private buckets | NOT VERIFIED against hosted Storage |
| Owner bootstrap | NOT RUN: owner email and dedicated project needed |
| Owner login/logout | NOT RUN against hosted Auth |
| Random authenticated, inactive, staff and unprovisioned access | NOT RUN against hosted Auth/PostgREST; local SQL coverage only |
| Session persistence and refresh | NOT RUN |
| Unauthenticated CRM redirect | PASS locally through built-app HTTP checks |
| Real public form → hosted transaction | NOT RUN |
| Returning client matching and duplicate retry | NOT RUN hosted; PGlite checks passed |
| Package/custom-menu/contact/date/guest persistence | NOT RUN hosted |
| Hosted throttling | NOT RUN |
| Safe validation and transaction-only success | Validation tests passed and code inspected; real hosted success/failure branches unexercised |
| Valid Turnstile token | NOT RUN: widget keys unavailable |
| Invalid/missing Turnstile token in configured production mode | NOT RUN; source requires verification and ignores local bypass in production |
| Authenticated dashboard/leads/client/event browser flows | BLOCKED by owner login |
| Stage/lost reason, notes/archive, conversion/edit, audit and re-login persistence | NOT RUN in authenticated browser |
| Owner Storage upload/retrieval | NOT RUN |
| Anonymous/unauthorized Storage retrieval | NOT RUN against hosted Storage |
| Public bucket URLs denied | NOT RUN against hosted Storage |
| Storage cleanup | No hosted test artifacts created |
| Deployment preview | NOT DEPLOYED; waits for hosted-backend acceptance as requested |
| Production domain | Unchanged |

No discrepancy between PGlite and hosted Supabase can yet be established: there is no hosted test result to compare. PGlite uses test-created Auth/Storage schemas and roles; it does not exercise Supabase Auth, PostgREST, Storage HTTP endpoints, or token refresh. Local successes must not be promoted to hosted results.

## Turnstile setup required

In the [Cloudflare dashboard](https://dash.cloudflare.com/), select the intended account, open **Turnstile → Add widget**, name it `The Chef Catering Preview`, add the actual preview hostname (and a permitted localhost hostname if needed), select Managed mode, then create the widget. Copy the site key into `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and its secret into `TURNSTILE_SECRET_KEY`. These steps were checked against [Cloudflare's official widget-management documentation](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/).

Store the values in the ignored local `.env.local` file and the deployment project's **Preview** environment settings. Do not paste secrets into this report, commit them, or reuse the secret in a `NEXT_PUBLIC_` variable. Rebuild after setting the public site key. Set `APP_ORIGIN` to the exact origin used by the form; verification also checks the widget hostname and `catering_inquiry` action. The frontend suppresses Turnstile's automatic response field and sends the token explicitly.

For practical local development, `ALLOW_LOCAL_INQUIRIES=true` bypasses Turnstile only when `NODE_ENV` is not production. This is not a substitute for production-mode Turnstile acceptance. Do not claim Cloudflare dummy testing keys prove a real production widget.

## Preview preparation

Configuration remains: Vercel project root `the-chef-next`, install `npm ci`, build `npm run build`, no static export. A preview target/project and origin must be identified, and its environment configured separately from Production. Use a stable preview hostname compatible with `APP_ORIGIN` and Turnstile hostname checks. No production alias or domain should be promoted during acceptance.

No hosted preview has been created, no deployment credentials have been exercised, and no hosted environment separation has been verified. The existing local preview is not a deployed acceptance environment.

## Checks rerun in this phase

| Check | Result |
|---|---|
| Production build | PASS — Next.js 15.5.25 |
| Typecheck | PASS |
| Lint | PASS with one existing unused-import warning in `app/layout.tsx`; no errors |
| Automated tests | 25 passed, zero failures/skips, with no-credentials HTTP tests targeting local port 3102 |
| Full dependency audit | Zero vulnerabilities reported |
| Browser Catering regression | Keyboard reveal sets `locked-chef`; inquiry CTA points to `/catering/inquiry` |
| Browser Music regression | Unlock then music reveal sets `locked-rapper`; separate music mailto links preserved; all three audio elements reached readyState 4 |
| Browser error log | No errors on the fresh regression tab |
| Framework/dependency freeze | `package.json` and lockfile unchanged from baseline |
| Public branding and source preservation | Global CSS, music/split source, track data and public assets unchanged |

These are local regression results, not final hosted acceptance. The complete suite must run again after hosted configuration and any necessary integration fixes.

## Files changed

- `docs/PHASE1_5-REPORT.md` — this new access/status report and exact configuration requirements.

No application code, schema/migration, dependency, framework, branding or feature changes were made. No temporary hosted documents, inquiries or users were created.

## Required input and next checkpoint

1. Confirm the Supabase organization for the dedicated project: Wavy Sites LLC is available. Alternatively provide the exact existing **catering-only** project reference. If creating, the next step is to retrieve and present its cost before creation.
2. Provide the intended owner's email. After project creation, provision the Auth account securely and apply the existing `seed.sql` UUID-based bootstrap. Do not post a password in chat; use protected local configuration or enter it directly during login when needed.
3. Configure the project URL, publishable key and server secret in `.env.local` using the existing example. The selected project's connector may supply project details, but a server intake credential is still required. The HMAC secret can be generated locally during setup.
4. Create the preview Turnstile widget and configure its site/secret keys as described above, or provide authorized Cloudflare access for widget setup.
5. Identify the Vercel preview project/team and permitted preview hostname when backend acceptance is ready. Do not change the production domain.

Resume at dedicated project provisioning, apply the existing migration through migration tooling, inspect hosted catalogs/policies, then provision owner and exercise the actual browser/Auth/PostgREST/Storage/Turnstile workflows. Stop for a final Phase 1.5 sign-off before any Phase 2 feature work.
