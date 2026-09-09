# The Chef Catering CRM — setup and verification

## Current delivery

Phase 1 code is implemented locally on `feat/catering-crm-foundation`. It is **not deployed or connected to a hosted catering database**. The connected Supabase account contains unrelated applications, so no existing project was changed. No email, SMS, payment or AI provider is configured or called.

Run commands from `the-chef-next/`. Node 22 or 24 is recommended (verified here on Node 24.20.0). Install with `npm ci`. Next.js is pinned to 15.5.25, preserving the existing React 18 application. PostCSS is overridden to 8.5.23 to fix inherited advisories; audit passed after this change. ESLint 9 is retained for compatibility with the Next.js 15 lint configuration; evaluate its supported successor alongside the next framework maintenance upgrade.

## Dedicated Supabase project

Create or select a **dedicated The Chef catering** Supabase project. Do not reuse the unrelated CRM projects. Database tables use normal names such as `clients`, so applying this migration to an unrelated/shared database is inappropriate.

1. Set up the project, keep Data API exposure limited to `public` (never expose `crm_private`), and use the project Connect dialog for URL/publishable key.
2. Disable public signups and anonymous sign-ins in hosted Auth settings. The local config already disables signups. This app has no signup route.
3. Configure the Auth Site URL to the deployed website origin. Create the owner in Supabase Auth through trusted administrative tooling, with a verified email and a securely delivered password. Public invitation acceptance/password-reset screens are not part of this phase; an operator needing recovery must use the project administrator.
4. Authenticate the CLI, then review and apply migrations:

   ```sh
   npx supabase link --project-ref YOUR_CATERING_PROJECT_REF
   npx supabase db push --dry-run
   npx supabase db push
   npx supabase db advisors --linked --type all
   ```

   CLI flags were checked against the installed version. Supply credentials through prompts or protected environment configuration, not committed files or shell history arguments. Do not use `db reset` against production.

5. Provision the first owner with the reviewed `supabase/seed.sql` bootstrap. In one trusted SQL session, set `crm.bootstrap_owner_id` to the actual Auth user UUID using `set_config`, then execute the seed file. With no setting, the seed is a no-op; it refuses to create another owner when one exists. It does not create passwords, match on an unverified email, or promote the first signup.
6. Later role grants/revocations should be explicit reviewed migrations to `profiles`, using existing Auth UUIDs. Users cannot modify role records through the app. Deactivation is checked from the database on every request. Owner and manager can access operational data; staff/unprovisioned accounts are denied until assigned-event/task views are implemented.

The migration creates `profiles`, `clients`, `leads`, `events`, `activity_log`, private request/rate-limit tables, restricted functions/triggers, and two private storage buckets. No file upload/download UI exists yet. Storage object read/insert/update is operator-only; there is no delete policy.

## Environment

Copy `.env.example` to `.env.local` locally; configure matching variables in Vercel Preview/Production settings. Do not commit `.env.local`. Set production variables before building so public widget keys are compiled correctly.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dedicated catering project API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public Supabase key; RLS is the authorization boundary |
| `SUPABASE_SECRET_KEY` | Server-only Supabase secret/service-role key used exclusively for transactional public intake |
| `APP_ORIGIN` | Exact origin, e.g. `https://your-domain.com`, no trailing slash; inquiry POSTs require this Origin |
| `INQUIRY_RATE_LIMIT_SECRET` | Long random server-only HMAC secret; do not reuse another provider key |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public Cloudflare Turnstile widget key |
| `TURNSTILE_SECRET_KEY` | Server-only Turnstile verification key |
| `ALLOW_LOCAL_INQUIRIES` | Optional `true` only for local development; ignored by production builds |

Turnstile must allow the exact domain. Verification checks hostname and `catering_inquiry` action. Production intake fails closed without server configuration or a valid challenge. Phone fallback remains available. For preview deployments, use an explicitly configured preview origin and widget domain, not a wildcard origin bypass.

The public endpoint checks body size (24 KB), input schema, origin, CAPTCHA and persistent hourly limits (3 per email, 10 per network). On Vercel it uses the platform-managed network header. Other deployments intentionally share a conservative global network bucket until a trusted proxy adapter is implemented. Configure edge-level request limiting as appropriate before a public launch; invalid requests do not reach database intake. Periodically prune old rate-limit rows through a reviewed maintenance migration/job; request IDs intentionally retain replay protection. No scheduled worker is enabled in Phase 1.

## Local and deployment checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run start -- --hostname 127.0.0.1 --port 3100
```

`npm test` runs input and PostgreSQL workflow/RLS tests. To include no-credentials HTTP tests, start the built app with **no Supabase or APP_ORIGIN configuration**, then set `TEST_BASE_URL=http://127.0.0.1:3100` for `npm test`. Those tests deliberately check the unconfigured fail-closed behavior; do not point them at production.

Tests execute the actual migration using PGlite, bootstrapping test-only equivalents of Supabase Auth/Storage schemas and roles. This verifies SQL, grants, RLS and triggers; it does **not** prove hosted Supabase Auth, PostgREST cookie refresh, CAPTCHA delivery or real Storage upload behavior. Docker/psql were unavailable locally. Use a dedicated Supabase preview project for the remaining acceptance tests.

Vercel root directory remains `the-chef-next`, build `npm run build`, install `npm ci`. Do not configure static export: private CRM and intake require a server runtime. Existing marketing routes remain prerendered. No deployment or Git push was performed.

## Acceptance tests requiring your project

- Sign in as owner and manager; open all CRM routes and sign out. Check session refresh after expiry. Confirm staff, inactive and unprovisioned accounts are denied even with a valid Auth session.
- Submit an inquiry with a real Turnstile challenge. Confirm one client, one lead and audit records; repeat the same request to verify idempotency. Submit a later inquiry for the same email and confirm its original contact details remain unchanged.
- Move a lead stage, record a lost reason, create/open its prospective event, change the event guest count and inspect history. Reopen pages to verify persistence.
- Confirm private bucket objects cannot be fetched anonymously and authorized upload/read works through Supabase tooling. Run hosted database advisors and review every finding.
- Check desktop/mobile operational screens with real records. Current browser verification covers public intake, package selection, unauthenticated login, and public split/music regression, not authenticated CRM rendering.

Do not switch production traffic to online intake until these checks pass. A local `201` database save means inquiry received, not a confirmed event. Acknowledgment is currently on-screen only; email acknowledgments, outbound follow-ups, notifications outside the dashboard and automated eligibility rules are deferred.

## Current product limits

- Lead list/board with detail-page status control; no drag-and-drop or full table view yet.
- Search filters the most recent 200 records; server-side pagination/full-history search remains next work.
- Client notes/archive and reusable relationships; no standalone manual client creation/editing workflow yet.
- Event creation copies historical package and requested menu. Event status and sales-pipeline status are separate manually maintained fields; no cross-state automation is implied.
- No operational readiness approval, quotes, contracts, deposits, payments, document upload UI, AI, SMS, emails, calendar or scheduler in this foundation.
- Owner/manager operational access; no user-management/settings UI, and staff have no operational access yet.

## References consulted

- [Supabase SSR clients and verified identity](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase changelog](https://supabase.com/changelog)
- [Next.js 15 migration guide](https://nextjs.org/docs/app/guides/upgrading/version-15)
- [Next.js Windows security advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)
