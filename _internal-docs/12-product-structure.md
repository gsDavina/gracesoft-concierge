# Concierge — Full Product Folder Structure

*Draft. How the MVP monorepo ([03-project-structure.md](./03-project-structure.md))
grows to support the full product ([10-product-milestones.md](./10-product-milestones.md)).
Same stack and the same rules: pnpm workspaces + Turborepo, TypeScript throughout, one
shared backend, separately deployed frontends.*

## What changes from the MVP, and why

| Change | Why | Milestone |
|---|---|---|
| **New `apps/worker`** | Reminders, calendar sync, retention and webhook processing need retries and must not slow down web requests | M1 |
| **`packages/shared-types` becomes `packages/contracts`** (zod schemas) | One definition validates requests in the API and types the frontends | M0 |
| **New `packages/crypto`** | KMS envelope encryption and key rotation in one audited place, instead of inside the API | M0 |
| **New `packages/channels`** | WhatsApp, Telegram and web share one conversation engine; each channel is a thin adapter | M1 |
| **New `packages/scheduling`** | The slot engine as pure functions, so multi-practitioner rules can be unit-tested exhaustively | M2 |
| **New `packages/ui`** | Brand components (Wordmark, Mark), design tokens and shared React components, currently copied into each app | M0–M3 |
| **`apps/demo` becomes `apps/web`** | The public site: marketing, pricing, signup, patient booking page, manage-booking links | M3 |
| **New `apps/console`** | GraceSoft internal operations, with no access to patient identity | M3 |
| **New `e2e/` and `infra/`** | Playwright tests across apps; deploy config and local services kept in the repo | M0–M1 |

## Directory layout

```
/apps
  /api                  Fastify HTTP API: the only app that handles decrypted PII
    /src
      /modules          One folder per domain; each has the same shape:
        /booking          routes.ts · service.ts · repository.ts · __tests__/
        /identity         (unmask + audit; the only caller of packages/crypto decrypt)
        /scheduling       (HTTP wrapper around packages/scheduling)
        /practitioners
        /locations
        /onboarding       (wizard, LLM extraction, vertical templates)
        /channels         (webhook routes: /webhooks/telegram, /webhooks/whatsapp)
        /calendar-sync    (OAuth connect/disconnect; sync itself runs in the worker)
        /billing          (Stripe checkout, portal, webhooks)
        /dsr              (data subject access and deletion requests)
        /audit            (audit log read and export)
        /staff            (invites, roles)
      /plugins          auth, tenant context (sets the RLS business id), rate limit, error handler
      /lib              env (zod), logger (PII redaction), request context
      app.ts · server.ts

  /worker               Background jobs (pg-boss on Postgres, so no Redis is needed at first)
    /src
      /jobs             reminders · calendar-sync · retention · waitlist-offers ·
                        webhook-processing · dsr-export · key-rotation
      /schedules        cron definitions
      worker.ts

  /admin-owner          Concierge Admin: owners and managers (Next.js)
    /src/app            bookings · schedule · practitioners · locations · blueprint ·
                        channels · calendar · staff · audit-log · privacy (retention, DSR) ·
                        billing · analytics · settings

  /admin-kiosk          Concierge Kiosk: front desk (Next.js)
    /src/app            queue · walk-in · self-check-in (QR / short code) · kiosk-mode

  /web                  Public site and patient pages (Next.js; replaces /demo)
    /src/app
      /(marketing)      home · pricing · privacy · security · demo · legal
      /(signup)         signup · verify · onboarding hand-off
      /book/[slug]      patient web booking page
      /manage/[token]   magic-link manage-booking (reschedule / cancel)

  /console              GraceSoft internal operations (Next.js, behind Cloudflare Access)
    /src/app            tenants · health · billing-status · break-glass requests

/packages
  /db                   Prisma schema, migrations, client; RLS policies as SQL migrations
  /contracts            zod schemas for every API request/response and webhook payload;
                        exports inferred TS types. No business logic, no PII handling.
  /auth                 roles, permission map, session verification (Clerk/Auth.js)
  /crypto               envelope encryption, KMS client, key rotation. Imported ONLY by
                        apps/api and apps/worker.
  /channels             conversation engine (state machine) + adapters:
    /engine               states, transitions, copy keys
    /telegram             update parsing, send, inline keyboards
    /whatsapp             Cloud API parsing, templates, 24h session rules
    /web                  patient booking page adapter
  /scheduling           pure slot engine: hours, breaks, leave, buffers, practitioners,
                        holidays, booking windows, waitlist ordering
  /calendar             provider adapters: google · microsoft (token-only event mapping)
  /ui                   brand components (Wordmark, Mark), design tokens, shared React UI
  /i18n                 message catalogues: en · zh-Hans · ms · ta
  /observability        logger with PII redaction, Sentry setup, tracing helpers
  /testing              factories, fixtures (webhook payloads, clinic setups),
                        testcontainers setup
  /config               shared eslint / tsconfig / prettier configs

/e2e                    Playwright tests across apps, run against staging
  /admin · /kiosk · /web · /flows (signup-to-first-booking, unmask-and-audit)

/infra
  docker-compose.yml    local Postgres (+ Mailpit for email)
  /railway              railway.json per service (build, pre-deploy, start commands)
  /runbooks             bot-down · sync-failure · key-compromise · breach-notification

/.github
  /workflows            ci.yml (typecheck, lint, unit, integration) · e2e.yml · deploy.yml
  dependabot.yml

/_internal-docs         Planning, specs, compliance and brand docs (this folder)
```

## Boundary rules (enforced by lint, not convention)

- **Only `apps/api` and `apps/worker` handle PII.** They are the only importers of `packages/crypto` and of the `identities` model. An ESLint `no-restricted-imports` rule fails the build if anything else imports them.
- **Frontends import only `contracts`, `auth` (client side), `ui` and `i18n`.** They never import `db`, `crypto`, `channels`, `calendar` or `scheduling`.
- **Apps never import from other apps.** Shared code moves to `/packages`.
- **`packages/scheduling` and `packages/channels/engine` are pure:** no database, network or clock access; the time is passed in. That makes them fully unit-testable.
- **`apps/console` has no identity routes.** The only path to patient data is the audited break-glass flow in `apps/api`.

## Deployment (Railway)

One Railway project per environment (staging, production), each with:

| Service | Source | Public? |
|---|---|---|
| api | `apps/api` | Yes (webhooks and frontends call it) |
| worker | `apps/worker` | No |
| admin-owner | `apps/admin-owner` | Yes, behind Cloudflare Access until real auth is proven |
| admin-kiosk | `apps/admin-kiosk` | Yes, behind Cloudflare Access |
| web | `apps/web` | Yes (public) |
| console | `apps/console` | Behind Cloudflare Access (GraceSoft staff only) |
| Postgres | Railway plugin | No; point-in-time recovery enabled |

Build, pre-deploy and start commands live in `infra/railway/*.json`, not in the Railway
dashboard, so they're reviewed in pull requests.

## Migration path from today's repo

Rename and move in small steps, keeping the app working after each one:

1. **M0:** add `contracts`, `crypto`, `observability`, `testing` and `ui`; move the brand components into `ui`; add `e2e/`, `infra/` and CI.
2. **M1:** add `apps/worker`; move the retention cron and new reminder/sync jobs there; extract the Telegram bot into `packages/channels`.
3. **M2:** extract `AvailabilityService` logic into `packages/scheduling`.
4. **M3:** rename `apps/demo` to `apps/web` and add the signup and patient pages; add `apps/console`.
