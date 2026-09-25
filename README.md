# GraceSoft Concierge

A privacy-first booking assistant for small service businesses (GP clinics first).
Bookers message a WhatsApp/Telegram bot to book an appointment; the bot only ever
writes an opaque token — never a name, phone number, or notes — to the shared calendar
and booking records. Turning a token back into a person requires an authenticated staff
session, a stated reason, and is always logged. See
[`_internal-docs/05-privacy-spec.md`](_internal-docs/05-privacy-spec.md) for the full
architecture.

## Monorepo layout

pnpm workspaces + Turborepo. One shared backend, several independently-deployed
frontends.

```
/apps
  /api            Fastify + TypeScript backend — booking/identity logic, the
                   onboarding wizard, and the Telegram bot webhook
  /admin-owner    Owner dashboard (blueprint editor, bookings, audit log)     — :3001
  /admin-kiosk    Front-desk check-in queue, kiosk-mode UI                    — :3002
  /demo           Public, unauthenticated trust-surface demo + pricing page  — :3003

/packages
  /db             Prisma schema, migrations, DB client — single source of truth
  /shared-types   TS types shared across apps — no business logic, no PII handling
  /auth           Role definitions + session helpers shared by both admin apps
  /config         Shared eslint / tsconfig / prettier base configs
```

See [`_internal-docs/03-project-structure.md`](_internal-docs/03-project-structure.md)
for the full rationale and deployment notes.

## Prerequisites

- Node.js 20+
- pnpm (`packageManager` pins `pnpm@11.16.0`; corepack will pick this up automatically)
- A local PostgreSQL instance

## Getting started

```bash
pnpm install

# Point each app at your local Postgres / dev secrets — copy and fill in:
cp apps/api/.env.example apps/api/.env
cp apps/admin-owner/.env.example apps/admin-owner/.env
cp apps/admin-kiosk/.env.example apps/admin-kiosk/.env

# packages/db has no .env of its own — export DATABASE_URL for the migrate/generate
# commands below (same value you put in apps/api/.env):
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gracesoft_concierge?schema=public"

# Create the gracesoft_concierge database in Postgres yourself first, then:
pnpm db:migrate
pnpm db:generate

# Seed a dev business + an owner and a front-desk staff user:
pnpm --filter @gracesoft/api seed:dev

# apps/api's scripts load apps/api/.env via Node's --env-file-if-exists (Node >= 22.9);
# vars already exported in your shell take precedence over the file.

# Run everything (api :3000, admin-owner :3001, admin-kiosk :3002, demo :3003):
pnpm dev
```

`apps/demo` needs no `.env` — it's a fully client-side, unauthenticated app with no
calls to `apps/api`.

### Dev-only sign-in

There's no real auth provider wired in yet (see
[`_internal-docs/06-progress-log.md`](_internal-docs/06-progress-log.md)) — both admin
apps have a dev-only login screen that seeds a local session from a business/staff id.
Use the ids printed by `seed:dev`.

### Trying the Telegram bot without a real bot token

`apps/api` falls back to logging bot replies instead of sending them when
`TELEGRAM_BOT_TOKEN` is unset, so the full booking conversation is exercisable by
POSTing simulated Telegram updates straight at `POST /webhooks/telegram` (see
`apps/api/.env.example` and `apps/api/scripts/telegram-set-webhook.mjs` for what's
needed to go live with a real bot).

## Common commands

Run from the repo root; Turborepo fans these out to every package/app:

```bash
pnpm dev          # run every app's dev server
pnpm build        # build every app/package
pnpm typecheck    # tsc --noEmit everywhere
pnpm test         # vitest (apps/api's unit tests)
pnpm lint         # eslint / next lint everywhere
pnpm format       # prettier --write
```

Scope any command to one package with `--filter`, e.g.
`pnpm --filter @gracesoft/api test`.

## Documentation

Project docs live in [`_internal-docs/`](_internal-docs/):

- [`01-milestones.md`](_internal-docs/01-milestones.md) — phased roadmap and current status
- [`03-project-structure.md`](_internal-docs/03-project-structure.md) — architecture and deployment
- [`05-privacy-spec.md`](_internal-docs/05-privacy-spec.md) — the privacy architecture (sales-collateral-ready)
- [`06-progress-log.md`](_internal-docs/06-progress-log.md) — running implementation log, in order
- [`07-compliance-posture.md`](_internal-docs/07-compliance-posture.md) / [`08-dpa-template.md`](_internal-docs/08-dpa-template.md) — PDPA/HIPAA-aligned posture and a DPA starting point (drafts — need legal review before use)
