# Catering CRM implementation

## Inspection and scope

The ZIP and workspace source/assets match byte-for-byte (README restored from ZIP). The ZIP's Git history is preserved. Baseline commit: 20669e4. Baseline Next.js 14.2.35 production build passed; npm audit reported high/critical Next.js/PostCSS advisories. No backend, auth, migrations, tests, lint configuration, or lockfile existed. Routes were `/`, `/gallery`, `/reviews`, robots and sitemap. Deployment is GitHub to Vercel with automatic Next.js detection; no hosting manifest or custom deployment configuration exists.

React 18 client components implement the interactive split, menus, galleries, modals and audio. Typed content lives in `data/`; all styling is plain `app/globals.css`, using DM Sans, Cormorant Garamond, Cinzel and gold catering accents. `SplitStage` owns the divider position (drag, release spring, lock and unlock; maths in `lib/split-physics.ts`) and writes clip-path, transform and opacity directly to a few elements, plus the body classes for the locked state. It renders independent, memoised `CatererWorld` and `RapperWorld` trees. Music booking uses separate contact constants. No existing forms submit customer data.

The complete supplied blueprint is the master specification. The user's Phase 1 explicitly includes intake/leads/clients/events beyond blueprint Phase 1. Commercial recommendations in the document are background, not instructions to charge, publish or contact anyone.

## Plan

1. Preserve baseline and fix dependencies; retain App Router and React architecture.
2. Add cookie-based Supabase auth, independent private CRM routes, database roles/RLS, private storage and migration-based owner provisioning.
3. Add one catering intake endpoint with validation, anti-bot protection, durable throttling and transactional client matching/lead/activity creation.
4. Add dashboard, searchable clients/leads/events, audited pipeline changes and idempotent event conversion with historical package snapshots.
5. Verify build/types/lint, database workflow and permissions tests, HTTP boundary tests and browser flows. Document external setup and all untested boundaries.

## Boundaries

Music components, tracks, split interaction, public assets and global marketing CSS stay unchanged. Catering CTA destinations change in BookingCTA, CatererMenu, GalleryGrid and the reviews page. The CRM uses its own scoped stylesheet. No public admin link is added. No quotes, payments, AI or outbound messages are sent in this phase. Dashboard notifications are real new-inquiry records; acknowledgment email delivery is deferred to the communication phase.

## Security architecture

Staff authentication is invitation-only. A protected profiles table controls roles; editable user metadata is never used. Owner/manager access the foundation CRM; staff and unprovisioned accounts are denied until assigned-event views exist. Every server query/mutation verifies identity and membership; RLS independently enforces this. No authenticated user can grant roles, hard-delete records or rewrite audit history. Private storage is restricted to owner/manager and is not exposed by public pages.

Public intake is server-only, limited to one transactional RPC with a server secret. It returns no contact lookup or record identifiers. Duplicate request UUIDs are payload-bound. Returning email matches without overwriting existing contact details; the original inquiry is retained. Email and network limits are persisted in PostgreSQL. Production requires Turnstile; missing configuration fails closed. No public table grants allow customer reads/writes.

## Next phases

Phase 2: operational event workspace (menu approval, venue/COI, private uploads, tasks/readiness, calendar), followed by quote/deposit tracking, provider-backed acknowledgments and follow-ups with an idempotent outbox. Then AI summaries/drafts and reporting. Online payments, portal, e-signatures and music CRM remain outside this foundation.
