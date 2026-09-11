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

**Next up:** `apps/admin-owner` and `apps/admin-kiosk` scaffolding, then Phase 1
(Onboarding Wizard).
