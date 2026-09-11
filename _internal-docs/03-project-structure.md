# Concierge — Project Structure

## Repository Strategy

**Monorepo** (pnpm workspaces + Turborepo). One shared backend and shared data model, with two genuinely separate frontend build outputs.

Rationale:
- Shared types across the API/frontend boundary (booking schema, roles, permissions) stay in sync — a schema change fails to compile immediately if a frontend is out of date, rather than breaking silently in production.
- Single source of truth for the DB schema/migrations.
- Atomic changes: a field added to bookings often touches API, DB schema, and one or both admin UIs in one PR.
- Does **not** compromise frontend separation — that's about independent build outputs, not which repo the source lives in.

## Directory Layout

```
/apps
  /api              → backend (Fastify + TypeScript)
                       - WhatsApp webhook (Meta Cloud API)
                       - Telegram webhook (Telegram Bot API)
                       - Booking / calendar logic (Google Calendar API)
                       - Blueprint / LLM orchestration
                       - Identity resolution + audit logging
  /admin-owner      → owner dashboard frontend
                       - Blueprint editor
                       - Booking history / analytics
                       - Settings (holidays, doctors, notifications)
                       - Restricted identity/audit log
                       - Billing
  /admin-kiosk      → front-desk queue/check-in frontend
                       - Today's live check-in queue only
                       - One-tap registration confirmation
                       - Deliberately minimal, kiosk-mode UI

/packages
  /db               → Prisma (or Drizzle) schema, migrations, DB client
                       - single source of truth for bookings + identities tables
  /shared-types     → TS interfaces shared across apps
                       - booking, role, and API contract types
                       - NO business logic, NO PII-handling logic
  /auth             → shared auth config/helpers
                       - Clerk or Auth.js setup
                       - role definitions (owner, front-desk)
  /config           → shared eslint / tsconfig / prettier base configs
```

## Boundary Enforcement

- `admin-owner` and `admin-kiosk` may only import from `/packages` — never from each other.
- Enforced at lint time via an ESLint `no-restricted-imports` rule (or Turborepo/Nx boundary rule), not just convention.
- `packages/shared-types` contains types only — real business logic and anything identity/PII-related stays in `apps/api`, so neither frontend can accidentally bundle sensitive logic client-side.

## Why Node/TypeScript for the Backend

Chosen specifically because it enables `packages/shared-types` to be imported directly by both frontends — one definition of the booking/role/API-contract shapes, used everywhere, with compile-time safety across the boundary. (If a Python backend is preferred instead, the monorepo still works, but an OpenAPI → TS type-generation step would be needed to get equivalent safety.)

## Deployment

- **Platform:** Railway (consolidates with existing Laravel Cloud / Railway usage — avoids spreading across a third platform like AWS or Fly.io purely for this project).
- Railway supports monorepos natively: each service (`api`, `admin-owner`, `admin-kiosk`) points at the same repo but a different root directory/build path.
- Result: one repo, one Railway project, three independently deployed and independently scaled services — matching the "separate apps, shared backend" architecture.
- Prefer a Singapore-region deployment if available, for latency and in-region data handling.

## Supporting Infrastructure (Referenced, Not Part of the Repo)

- **Edge/Network:** Cloudflare (free tier) in front of all public endpoints; Cloudflare Access (Zero Trust) gating both admin frontends.
- **Secrets:** platform-native encrypted secrets (Railway), or Infisical if secrets management needs grow.
- **Monitoring:** Sentry (PII-scrubbed) for error tracking; platform logs for general observability.
- **CI/CD:** GitHub Actions for deploys; Dependabot enabled for dependency vulnerability alerts.

## Future Extraction Path

If the kiosk app ever needs a hard, independent compliance/audit boundary (e.g., a different team manages it, or an audit requires zero shared git history with the owner dashboard), extracting `apps/admin-kiosk` into its own repository is a clean, low-risk move at that point. Not a concern at the current stage — monorepo → polyrepo extraction is straightforward; the reverse is not.