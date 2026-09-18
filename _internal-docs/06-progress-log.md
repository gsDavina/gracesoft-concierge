# Concierge — Implementation Progress Log

Running log of what's been built against [01-milestones.md](./01-milestones.md), in
implementation order. Each entry says what was actually verified, not just written.

## 2026-09-11 — Monorepo scaffold + Phase 0 (Privacy Layer)

**Scaffolded** the monorepo per [03-project-structure.md](./03-project-structure.md):
pnpm workspaces + Turborepo, `packages/config` (shared eslint/tsconfig/prettier,
including the `admin-owner`/`admin-kiosk` import-boundary ESLint rule),
`packages/shared-types`, `packages/db` (Prisma), `packages/auth`, and `apps/api`
(Fastify). `apps/admin-owner` and `apps/admin-kiosk` directories exist but have no code
yet — next up.

**Implemented and verified** (Phase 0):
- Prisma schema: `Identity` (encrypted name/phone/notes) fully separate from `Booking`
  (token only), `StaffUser` (role mapping), `TokenLookupAudit`, `RetentionPolicy`,
  `Business.encryptionKeyId` (per-business key reference, not a stored key).
- AES-256-GCM field encryption (`apps/api/src/lib/crypto.ts`) — unit tested (round-trip,
  wrong-key failure, malformed-input rejection).
- `IdentityService.lookup` — authenticated actor + required reason, writes a
  `TokenLookupAudit` row *before* returning decrypted data.
- `RetentionService` — schedules identity deletion once all bookings under a token are
  terminal and past the business's retention window (with a 7-day grace period before
  hard delete), and purges audit rows past a separate audit retention window. Unit tested
  against a fake DB, then re-verified against a real local Postgres instance (migration
  applied, data seeded, job run, deletions confirmed).
- `CalendarAdapter` interface with an `InMemoryCalendarAdapter` for dev/tests — the
  interface's input type (`CalendarEventInput`) has no name/phone/notes field, so the
  "calendar never sees identity" guarantee is structural, not just a code-review
  convention.
- Fastify app (`apps/api`) wired end-to-end: `/bookings` (create/list),
  `/businesses/:businessId/identities/:token/lookup`, dev-only bearer-token auth
  (`DevSessionProvider`), role guards (`requireStaff`/`requireOwner`), typed error
  handler (401/403/400 mapped correctly — caught a bug here: unauthenticated requests
  were returning 500 until `registerErrorHandler` was added).
- End-to-end smoke test against a real local Postgres: created a business + staff user,
  created a booking (booking → in-memory "calendar" event → status `confirmed`), created
  an identity, looked it up through the HTTP route, confirmed the audit row was written,
  confirmed the raw DB row is ciphertext (not `"Jane Tan"`), confirmed an unauthenticated
  lookup is rejected with 401.
- Wrote [05-privacy-spec.md](./05-privacy-spec.md) — the Phase 0 sales-collateral
  deliverable.

**Deliberately not done yet** (needs accounts/credentials this environment cannot
create — flagged rather than faked):
- `GoogleCalendarAdapter` is a stub that throws — real Google Calendar OAuth needs a
  Google Cloud project and per-business OAuth credentials.
- `DevSessionProvider` is a base64-JSON bearer token, not real Clerk/Auth.js — needs a
  real auth provider account. `packages/auth`'s `SessionProvider` interface is the seam;
  swapping in a real driver won't require touching route code.
- Secrets manager (Railway secrets / Infisical) integration — `KeyProvider` interface is
  in place (`EnvKeyProvider` is the dev stand-in); production driver needs the actual
  secrets manager account.
- No CI workflow yet (GitHub Actions, per 03-project-structure.md).

**Verification commands** (for reference, not currently wired into CI):
```bash
pnpm --filter @gracesoft/api typecheck
pnpm --filter @gracesoft/api test
```

**Next up:** `apps/admin-owner` scaffolding, then Phase 1 (Onboarding Wizard).

## 2026-09-11 — `apps/admin-kiosk` (check-in queue frontend)

**Implemented and verified**:
- Added a `checkIn` capability to `BookingService`/`/bookings/check-in` (staff-authenticated,
  scoped to today's confirmed booking for a token) — the token doubling as the arrival
  credential the Pilot Track's check-in module calls for, without needing a name.
- `apps/admin-kiosk`: Next.js 14 app router, deliberately minimal kiosk-mode UI
  (large touch targets, no text selection, polls the queue every 15s). Shows only
  time/service/token — never a booker's name, matching the Phase 0 privacy boundary in
  the UI as well as the API.
- Added `@fastify/cors` to `apps/api`, scoped to the two admin frontend origins via a new
  `CORS_ORIGINS` env var.
- Dev-only sign-in page as the stand-in for real Clerk/Auth.js (same pattern as
  `DevSessionProvider` in apps/api).

**Verified in a real browser**, not just `next build`: ran a local Postgres, seeded a
business/staff user/three bookings, started `apps/api` and the kiosk dev server, signed
in, confirmed the live queue loaded from the API (2 waiting, 1 arrived), tapped "Check
in" on a waiting booking, confirmed it moved to "Arrived" in the UI, and confirmed the
underlying `bookings.status` row actually changed in Postgres (not just local UI state).

**Deliberately not done yet**: `apps/admin-owner` (blueprint editor, booking
history/analytics, settings, audit log, billing) — next up.

## 2026-09-11 — `apps/admin-owner` (bookings + restricted audit log)

**Implemented and verified**:
- `IdentityService.listAuditLog` + owner-only `GET /businesses/:businessId/audit-log` —
  a narrower privilege than the lookup itself (front-desk can look a token up; only
  owner can review who has been doing the looking up). Returns who/what/when/why, never
  decrypted identity data.
- `apps/admin-owner`: Next.js 14 app router, same dev-session pattern as admin-kiosk but
  seeded with the `owner` role. Two pages: a bookings table (all bookings, not just
  today — "Booking history / analytics" from 03-project-structure.md) and an audit-log
  page that also hosts the one UI-driven identity lookup (token + required reason →
  audit row appears in the table below immediately after).
- Verified with `next build` (typecheck + lint clean) and a real local Postgres +
  `apps/api` instance: seeded a business/owner/booking/identity, confirmed `/health` and
  the API came up correctly. Browser verification of the running admin-owner dev server
  was interrupted before completion — **not yet confirmed in a live browser**, unlike
  admin-kiosk. Re-run before trusting this page beyond "it builds and typechecks."

**Still open across both frontends**: no real auth provider (both use the same
`DevSessionProvider`-compatible localStorage session as apps/api's dev stand-in), no
blueprint editor, no settings page, no billing page — all out of scope for what's been
asked so far.

**Push status**: local commits are ahead of `origin/main`. Pushing is blocked — the
`gh` CLI here is authenticated as `davinaleong`, but the configured remote
(`github.com/gsDavina/gracesoft-concierge.git`) isn't visible to that account
(`git ls-remote` under both `davinaleong` and `gsDavina` returns "Repository not
found"). User chose to re-auth `gh` as `gsDavina`
(`gh auth login --hostname github.com --web`, run in an interactive terminal) — retry
the push once that's done.

*Resolved*: re-auth completed, `origin` now points at
`https://gsDavina@github.com/gsDavina/gracesoft-concierge.git` and all prior commits
are pushed.

## 2026-09-18 — Phase 1 kickoff: public-holiday auto-blocking

**Fixed a pre-existing bug before building on top of the auth model**: the `Role` type
in `packages/shared-types` used `"front-desk"` (hyphen) while the Prisma `Role` enum
uses `front_desk` (underscore). Nothing exercised the mismatch yet (the dev session
provider builds the actor client-side, it never round-trips through `StaffUser.role`),
but the new Blueprint/onboarding endpoints planned for the rest of Phase 1 are
owner-gated and will read roles from the DB, so this would have surfaced as a silent
`requireOwner`/`requireStaff` failure. Aligned `shared-types`, `packages/auth`, and the
one hardcoded dev-login value (`apps/admin-kiosk/src/app/login/page.tsx`) on
`front_desk` to match the DB enum, which is the source of truth.

**Implemented and verified** (Phase 1 — "Public-holiday auto-blocking added to
calendar/scheduling logic (by region)"):
- `HolidayProvider` interface (`apps/api/src/modules/holiday/holidayProvider.ts`) — same
  swappable-seam pattern as `CalendarAdapter`/`KeyProvider`.
- `NagerDateHolidayProvider` — the real, production default. Unlike Google Calendar,
  [Nager.Date](https://date.nager.at) is a free, keyless public-holiday API, so no
  OAuth/credentials gap here; region codes are ISO 3166-1 alpha-2, matching
  `Business.region` (e.g. `"SG"`) directly. Fails open (logs and returns no holidays)
  on a fetch error so a third-party outage can never block a real booking; caches
  results per region+year for the process lifetime.
- `StaticHolidayProvider` — in-memory table for tests/offline dev.
- `toLocalDateString()` — resolves a booking's local calendar date using
  `Business.timezone` via `Intl.DateTimeFormat`, not naive UTC slicing. Covered by a
  test that specifically picks a UTC timestamp that crosses midnight SGT
  (`2025-12-31T16:30:00Z` = `2026-01-01` in `Asia/Singapore`) to prove the timezone
  handling is real, not accidental.
- `BookingService.create()` now calls `assertNotOnHoliday()` before writing the booking
  row or touching the calendar adapter; throws the new `HolidayBlockedError` (mapped to
  HTTP 409 in `errorHandler.ts`) when the booking's local date matches a holiday for the
  business's region.
- New `GET /holidays?businessId&year` route (staff-authenticated, scoped to the actor's
  own business) so admin-owner (and the upcoming onboarding review step) can display
  which dates are auto-blocked, not just have bookings silently rejected on them.
- Unit tests: `apps/api/src/modules/booking/__tests__/bookingService.test.ts` (blocks a
  holiday date, allows a non-holiday date, resolves the date in local time not UTC)
  against a hand-rolled fake Prisma client, matching the existing `retentionService`
  test pattern. `pnpm --filter @gracesoft/api test` — 13/13 passing (3 new). `pnpm
  typecheck` — 9/9 tasks passing across all packages.

**Deliberately not done in this pass**: no admin-owner UI surfaces the `/holidays`
endpoint yet (no settings page exists to put it on — out of scope until the onboarding
wizard/settings work below). No retry/backoff on `NagerDateHolidayProvider` beyond the
in-process cache — acceptable for a fail-open, non-critical enhancement.

**Next up:** Phase 1's remaining three items (onboarding input step, LLM auto-draft,
human-in-the-loop review) — these share one new domain (a `Blueprint` + onboarding
document model, currently nonexistent in the schema) and will be built together as
"the onboarding wizard."
