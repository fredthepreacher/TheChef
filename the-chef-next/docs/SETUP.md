# The Chef Catering CRM — setup and operations

## Current environment

The CRM uses the dedicated Supabase project `the-chef-catering-crm` (`pqfyhkehbwikeaongcdo`) in `us-east-1`. Do not apply its migrations to another project. Phase 1.5 hosted acceptance and Phase 2 hosted operations acceptance were completed against the Vercel Preview environment. The production domain was not changed or promoted.

The framework baseline remains Next.js 15 and React 18. Next.js was patched from 15.5.25 to 15.5.29, and Zod to 4.6.7, to clear disclosed security advisories; no major framework upgrade was performed. Use the exact package versions in `package-lock.json`, run with Node 22 or 24, and install with `npm ci`.

## Database and migrations

All database changes live in `supabase/migrations/`. Apply them through migration tooling:

```sh
npx supabase link --project-ref pqfyhkehbwikeaongcdo
npx supabase db push --dry-run
npx supabase db push
npx supabase db advisors --linked --type all
```

Never use `db reset` against the hosted project. Phase 3 adds quote revisions, secure proposal access, electronic acceptance evidence, event financials, an append-only payment ledger, Stripe webhook receipts, delivery attempts, automation rules, and controlled AI-generation history. All applicable public tables use RLS. `crm_private` stays outside the Data API and is service-only.

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
| `STRIPE_SECRET_KEY` | Server-only Stripe **test-mode** key. Phase 3 rejects non-`sk_test_` keys. |
| `STRIPE_WEBHOOK_SECRET` | Server-only signing secret for the Preview Stripe webhook endpoint. |
| `RESEND_API_KEY` | Server-only Resend credential. Do not configure until the Chef sending domain is approved. |
| `RESEND_WEBHOOK_SECRET` | Server-only Resend webhook signing secret. |
| `RESEND_FROM_EMAIL` | Verified Chef-owned From address. |
| `RESEND_REPLY_TO_EMAIL` | Approved Chef Reply-To address. |
| `CRON_SECRET` | Server-only random secret for bounded email/automation dispatch endpoints. |
| `AI_GATEWAY_MODEL` | Approved Vercel AI Gateway model identifier for operator-requested drafts. |
| `AI_GATEWAY_API_KEY` | Optional local server-only Gateway key; Vercel deployments may use OIDC. |

The public intake checks body size, schema, origin, Turnstile, and persistent hourly limits before calling the atomic database function. Successful intake creates or reuses the client, creates one lead, one follow-up task, one queued communication, and one private outbox item. A success response means the inquiry was saved; it does not reserve the date or confirm pricing.

## Private documents

COI and event files use the private `crm-documents` bucket. Operators upload and download with their authenticated browser session, so Storage RLS is enforced. Accepted files are PDF, JPEG, and PNG up to 10 MB. Replacements create a new metadata version and mark the prior version superseded. Archiving keeps metadata and history. No public URLs are generated.

The app grants operator delete access only so it can remove an orphan when metadata registration fails. Normal product removal archives metadata and retains the Storage object. Permanent retention and purge policy should be defined before production document volume grows.

## Phase 3 provider boundaries

The durable email outbox now has a bounded dispatcher, Resend adapter, signed delivery webhook, provider IDs, attempts, failure states, and idempotency. Delivery remains disabled until a Chef-owned domain/subdomain, From address, Reply-To address, API key, and webhook secret are configured in Vercel Preview. Do not use a real customer as an acceptance recipient.

Stripe Checkout is test-mode only. The server creates Checkout Sessions from database-calculated amounts; only a signature-verified webhook or a current authenticated operator can append payment entries. The webhook rejects unknown sessions and amount/currency mismatches and is duplicate-event safe. Success and cancellation pages never mark a payment paid.

Lifecycle automation creates approval-gated drafts for quote follow-up, booking confirmation, upcoming-event reminder, thank-you, review, and rebooking. A human operator must approve the action before it can enter the outbound email queue.

AI assistance is operator initiated and draft-only. It cannot update prices, discounts, agreements, payments, refunds, quote approval, booking, menus, COI status, or send communications. Keep the Vercel AI Gateway project budget at or below the approved $5/month ceiling.

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

- A human operator must approve COI and menu states; file presence does not infer approval.
- External calendar synchronization is not configured.
- Resend delivery, Stripe test payment, and AI generation remain configuration-gated until their Preview credentials are supplied and hosted acceptance is completed.
- Invoices, SMS, payroll/staff scheduling, certified third-party e-signatures, autonomous AI actions, and a general customer portal are not part of Phase 3.
- Production scheduling, live Stripe mode, real-customer acceptance messages, and production-domain promotion are prohibited in this phase.
- Supabase Auth leaked-password protection is currently reported disabled by the hosted security advisor. Enable it in the Chef project if the organization plan exposes that control.

See `docs/PHASE1_5-REPORT.md`, `docs/PHASE2-REPORT.md`, and `docs/PHASE3-REPORT.md` for evidence and remaining hosted gates.
