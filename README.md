# GraceSoft Concierge

A privacy-first booking assistant for small service businesses (GP clinics first).
Bookers message a WhatsApp/Telegram bot to book an appointment; the bot only ever
writes an opaque token — never a name, phone number, or notes — to the shared calendar
and booking records. Turning a token back into a person requires an authenticated staff
session, a stated reason, and is always logged. See
[`_internal-docs/05-privacy-spec.md`](_internal-docs/05-privacy-spec.md) for the full
architecture.

## The apps

| App | Port | Who it's for | What it does |
|---|---|---|---|
| `apps/api` | 3000 | — | Fastify backend: bookings, opening hours, identity lookups, onboarding wizard, Telegram bot webhook |
| `apps/admin-owner` | 3001 | Business owner | **Admin console** (dark sidebar): bookings overview, Blueprint editor (services, opening hours, FAQs), restricted identity lookup and audit log |
| `apps/admin-kiosk` | 3002 | Front desk | **Kiosk** (purple header, touch-sized): today's check-in queue with Waiting / Arrived / Next up |
| `apps/demo` | 3003 | Prospects | Public trust-surface demo and pricing page. Fully client-side — it never calls the API |

## Monorepo layout

pnpm workspaces + Turborepo. One shared backend, several independently-deployed
frontends.

```
/apps
  /api            Fastify + TypeScript backend
  /admin-owner    Owner console                                   — :3001
  /admin-kiosk    Front-desk check-in queue, kiosk-mode UI        — :3002
  /demo           Public, unauthenticated demo + pricing page     — :3003

/packages
  /db             Prisma schema, migrations, DB client — single source of truth
  /shared-types   TS types shared across apps — no business logic, no PII handling
  /auth           Role definitions + session helpers shared by both admin apps
  /config         Shared eslint / tsconfig / prettier base configs
```

See [`_internal-docs/03-project-structure.md`](_internal-docs/03-project-structure.md)
for the full rationale and deployment notes.

## Prerequisites

- Node.js 22.9+ (`apps/api` loads its `.env` with Node's `--env-file-if-exists`)
- pnpm (`packageManager` pins `pnpm@11.16.0`; corepack will pick this up automatically)
- A local PostgreSQL server, and its `postgres` user's password

## Getting started

```bash
pnpm install

# Copy each app's env file, then fill them in:
cp apps/api/.env.example apps/api/.env
cp apps/admin-owner/.env.example apps/admin-owner/.env
cp apps/admin-kiosk/.env.example apps/admin-kiosk/.env
```

In `apps/api/.env`, set `DATABASE_URL` **including the password**, e.g.
`postgresql://postgres:<password>@localhost:5432/gracesoft_concierge?schema=public`,
and put a real base64 32-byte key in `GRACESOFT_DEV_ENCRYPTION_KEYS` (the file explains
how to generate one).

`packages/db` has no `.env` of its own, so export the same `DATABASE_URL` in your shell
for the database commands:

```bash
# bash / zsh
export DATABASE_URL="postgresql://postgres:<password>@localhost:5432/gracesoft_concierge?schema=public"
```

```powershell
# PowerShell
$env:DATABASE_URL = "postgresql://postgres:<password>@localhost:5432/gracesoft_concierge?schema=public"
```

Then create the schema, seed a dev business, and start everything:

```bash
pnpm db:migrate    # creates the gracesoft_concierge database if it doesn't exist, then applies migrations
pnpm db:generate

# Seeds business dev-business-1 with users dev-owner-1 (owner) and dev-frontdesk-1 (front desk):
pnpm --filter @gracesoft/api seed:dev

# api :3000, admin-owner :3001, admin-kiosk :3002, demo :3003
pnpm dev
```

`apps/demo` needs no `.env`.

### Dev-only sign-in

There's no real auth provider wired in yet — both admin apps have a dev-only login
screen that starts a local session from a business id and staff id. Use the ids from
`seed:dev`: `dev-business-1` with `dev-owner-1` for Admin, or `dev-frontdesk-1` for Kiosk.

### Setting up opening hours

Bookings are only accepted inside the hours you publish. In Admin → **Blueprint** →
**Opening hours**, give each open day one or more time slots (for example 09:00–12:00
and 13:00–17:00 for a lunch break), then **Save draft** and **Publish**.

A booking must fit entirely inside one slot: with Monday 09:00–17:00, a 1-hour
appointment can start from 09:00 to 16:00. Anything else is rejected with HTTP 409
(`OutsideOpeningHours`) on every channel. Until a blueprint is published, bookings are
not restricted.

### Trying the Telegram bot without a real bot token

`apps/api` falls back to logging bot replies instead of sending them when
`TELEGRAM_BOT_TOKEN` is unset, so the full booking conversation is exercisable by
POSTing simulated Telegram updates straight at `POST /webhooks/telegram` (see
`apps/api/.env.example` and `apps/api/scripts/telegram-set-webhook.mjs` for what's
needed to go live with a real bot). `TELEGRAM_BUSINESS_ID` must be set to the business
the bot books for (e.g. `dev-business-1`).

## Troubleshooting

| Symptom | Cause |
|---|---|
| Admin/Kiosk show "Internal Server Error", but `GET :3000/health` is fine | The API can't reach Postgres. Check `DATABASE_URL` in `apps/api/.env` includes the password, and that `pnpm db:migrate` has been run. The API reads `.env` only when it starts, so restart it after editing |
| A booking made on the demo page doesn't show up in Admin or Kiosk | Expected: the demo is a client-only simulation and never sends anything to the API |
| A booking shows in Admin but not on the Kiosk | The kiosk only lists **today's** bookings |
| A booking is rejected with `OutsideOpeningHours` | It doesn't fit inside a published time slot — see [Setting up opening hours](#setting-up-opening-hours) |

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
`pnpm --filter @gracesoft/api test`. After changing `packages/shared-types`, rebuild it
(`pnpm --filter @gracesoft/shared-types build`) so the apps see the new types.

Known issue: `pnpm --filter @gracesoft/api lint` currently fails because `eslint` isn't
installed in that package.

## Documentation

Project docs live in [`_internal-docs/`](_internal-docs/) — start with its
[index](_internal-docs/README.md). The most used:

- [`01-milestones.md`](_internal-docs/01-milestones.md) — MVP roadmap and current status
- [`06-progress-log.md`](_internal-docs/06-progress-log.md) — running implementation log, in order
- [`10-product-milestones.md`](_internal-docs/10-product-milestones.md) — roadmap to the full, paid product (draft)
- [`05-privacy-spec.md`](_internal-docs/05-privacy-spec.md) — the privacy architecture (sales-collateral-ready)
- [`09-branding-guidelines.md`](_internal-docs/09-branding-guidelines.md) / [`04-assets.md`](_internal-docs/04-assets.md) — brand rules and where each asset is used
- [`07-compliance-posture.md`](_internal-docs/07-compliance-posture.md) / [`08-dpa-template.md`](_internal-docs/08-dpa-template.md) — PDPA/HIPAA-aligned posture and a DPA starting point (drafts — need legal review before use)
