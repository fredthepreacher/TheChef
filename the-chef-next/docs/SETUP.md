# The Chef Catering CRM — setup and operations

## Current environment

The CRM uses the dedicated Supabase project `the-chef-catering-crm` (`pqfyhkehbwikeaongcdo`) in `us-east-1`. Do not apply its migrations to another project. Phase 1.5 hosted acceptance and Phase 2 hosted operations acceptance were completed against the Vercel Preview environment. The production domain was not changed or promoted.

The framework baseline is intentionally frozen at Next.js 15.5.25, React 18, and the package versions in `package-lock.json`. Run from this directory with Node 22 or 24 and install with `npm ci`.

## Database and migrations

All database changes live in `supabase/migrations/`. Apply them through migration tooling:

```sh
npx supabase link --project-ref pqfyhkehbwikeaongcdo
npx supabase db push --dry-run
npx supabase db push
npx supabase db advisors --linked --type all
```

Never use `db reset` against the hosted project. The migrations create the Phase 1 CRM foundation plus reusable venues, event operations fields, menu revisions, preparation tasks, event-document metadata, communications, and the private email outbox. All applicable public tables use RLS. `crm_private` stays outside the Data API and is service-only.

The initial owner is already provisioned through the secure bootstrap process. There is no public signup route and public signup remains disabled. Future operator provisioning must use reviewed administrative tooling and an existing verified Auth UUID; client-editable JWT metadata is not an authorization source.

## Environment variables

Copy `.env.example` to ignored `.env.local` for local development. Configure matching values separately in Vercel Preview and Production. Never commit real values.

| Variable | Visibility and purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public URL for the dedicated Chef project. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public browser key; RLS remains the authorization boundary. |
| `SUPABASE_SECRET_KEY` | Server-only key used by the public inquiry transaction. |
| `APP_ORIGIN` | Exact application origin, without a trailing slash. Inquiry POSTs require this Origin. |
| `INQUIRY_RATE_LIMIT_SECRET` | Server-only HMAC secret for persistent rate-limit identifiers. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public Cloudflare Turnstile widget key. |
| `TURNSTILE_SECRET_KEY` | Server-only Turnstile verification secret. |
| `ALLOW_LOCAL_INQUIRIES` | Optional `true` in local development only; production ignores it. |

The public intake checks body size, schema, origin, Turnstile, and persistent hourly limits before calling the atomic database function. Successful intake creates or reuses the client, creates one lead, one follow-up task, one queued communication, and one private outbox item. A success response means the inquiry was saved; it does not reserve the date or confirm pricing.

## Private documents

COI and event files use the private `crm-documents` bucket. Operators upload and download with their authenticated browser session, so Storage RLS is enforced. Accepted files are PDF, JPEG, and PNG up to 10 MB. Replacements create a new metadata version and mark the prior version superseded. Archiving keeps metadata and history. No public URLs are generated.

The app grants operator delete access only so it can remove an orphan when metadata registration fails. Normal product removal archives metadata and retains the Storage object. Permanent retention and purge policy should be defined before production document volume grows.

## Email provider boundary

The database transaction now creates an idempotent inquiry acknowledgment in `public.communications` and `crm_private.email_outbox`. `lib/email/provider.ts` defines the delivery boundary and `lib/email/templates.ts` renders the branded acknowledgment. No provider is configured, no worker dispatches the outbox, and queued acknowledgments are not marked sent.

To enable delivery in a later phase:

1. Select and approve a transactional email provider.
2. Verify a Chef-owned sending domain with that provider.
3. Choose the From and Reply-To addresses.
4. Add the provider API credential only to server-side Vercel environment variables.
5. Implement a durable dispatcher with retries, provider message IDs, and delivery-state updates.

## Verification

```sh
npm run build
npm run typecheck
npm run lint
npm test
npm audit --omit=dev --audit-level=moderate
```

The PGlite suite executes all migrations and covers intake idempotency, RLS roles, venue snapshots, menu locking, task and document lifecycle rules, audit protections, readiness calculations, and Phase 1 regressions. The credential-gated HTTP test skips unless its dedicated test configuration is supplied; hosted HTTP, Turnstile, Auth, RLS, and browser boundaries were exercised separately and are recorded in the phase reports.

## Known operational boundaries

- Deposit and payment are explicitly shown as untracked and excluded from readiness.
- A human operator must approve COI and menu states; file presence does not infer approval.
- External calendar synchronization is not configured.
- Email acknowledgments remain queued until a provider and dispatcher are approved.
- Quotes, invoices, payments, advanced AI, SMS, payroll/staff scheduling, and a customer portal remain outside Phase 2.
- Supabase Auth leaked-password protection is currently reported disabled by the hosted security advisor. Enable it in the Chef project if the organization plan exposes that control.

See `docs/PHASE1_5-REPORT.md` and `docs/PHASE2-REPORT.md` for hosted evidence and cleanup results.
