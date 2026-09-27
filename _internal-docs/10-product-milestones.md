# Concierge — Full Product Milestones

*Draft. The roadmap from the working MVP ([01-milestones.md](./01-milestones.md)) to a
generally available, self-serve product that clinics pay for. Companion docs:
[11-product-test-checklist.md](./11-product-test-checklist.md) and
[12-product-structure.md](./12-product-structure.md).*

## What "full product" means

The MVP proves the idea: a privacy-first Telegram booking bot, a check-in queue, an owner
dashboard, and an onboarding wizard, for one dev business with dev-only sign-in. The full
product is what a paying clinic can sign up for, set up alone, and trust with real patient
data:

- **Real security:** real staff sign-in, tenant isolation enforced in the database, and
  encryption keys held in a key management service (KMS).
- **The channels patients use:** WhatsApp first, Telegram, and a web booking page.
- **Real clinic scheduling:** several practitioners, reschedule and cancel, reminders,
  no-shows, and a waitlist.
- **Two-way sync** with the calendar the clinic already uses.
- **Self-serve:** signup → onboarding → billing → go-live, with no GraceSoft staff needed.
- **Evidence for the privacy claims:** a pen test, data subject requests, an exportable
  audit trail, and a tested restore from backup.

**Assumptions:** healthcare (GP clinics) in Singapore first, one builder, TypeScript stack
kept (see the stack discussion in [03-project-structure.md](./03-project-structure.md)).
Estimates are rough and for one person.

## Release gates

| Gate | Reached after | What it permits |
|---|---|---|
| **Real data allowed** | M0 | Any real patient data in any environment |
| **Pilot** | M1 | 1–3 clinics, free, running alongside their current process |
| **Paid beta** | M3 | Up to ~20 clinics on paid plans, with onboarding help |
| **GA** | M5 | Public self-serve signup and marketing |

---

## M0 — Production Foundations (3–4 weeks) · gate: *Real data allowed*

The MVP's dev-only shortcuts become real systems. Nothing else ships until this is done.

- [ ] Real staff authentication (Clerk or Auth.js) replaces `DevSessionProvider`; MFA required for owners
- [ ] Staff invites and roles: `owner`, `manager`, `front_desk`, `practitioner`; permissions checked in the API, not only the UI
- [ ] Tenant isolation enforced in Postgres (row-level security keyed on `business_id`), not only in route code
- [ ] Per-business encryption keys held in a KMS using envelope encryption; `GRACESOFT_DEV_ENCRYPTION_KEYS` becomes local-dev only
- [ ] API contracts defined once as zod schemas in `packages/contracts`; the API validates with them and the frontends derive their types from them
- [ ] Environments: local (docker-compose), staging, production, each with its own database, keys, and bot tokens
- [ ] CI on every push: typecheck, lint, unit and integration tests, and migration check; Dependabot on
- [ ] Config fails fast at startup (API and all frontends); start scripts honour `PORT`
- [ ] Logging and error tracking redact PII by construction (Sentry with scrubbing, structured logger with a redaction list)
- [ ] Daily backups with point-in-time recovery; one restore test actually performed
- **Exit criteria:** security checklist section S passes; no dev-only code path is reachable in staging or production.

## M1 — Pilot-Ready Booking (4–6 weeks) · gate: *Pilot*

Everything a single-doctor clinic needs to run the bot alongside its current process.

- [ ] WhatsApp Cloud API channel (Meta verification, message templates, 24-hour session rules), sharing one conversation engine with Telegram
- [ ] Channel-agnostic conversation engine: one state machine, with an adapter per channel
- [ ] Reschedule and cancel from the chat, with a confirmation step
- [ ] Reminders (for example 24 h and 2 h before), configurable per business, using channel-approved templates
- [ ] Two-way Google Calendar sync over real OAuth: events hold the token only; external changes flow back as blocked time
- [ ] Background worker and job queue for reminders, sync, retention, and webhook processing, with retries and idempotency
- [ ] Webhook hardening: signature verification, idempotency keys, rate limiting, replay protection
- [ ] Human handoff: the patient types "talk to staff" → the front desk is notified, with no identity revealed in the notification
- [ ] Kiosk improvements: QR or short-code self check-in, tablet kiosk mode, live updates instead of 15-second polling
- [ ] Operational runbooks: bot down, calendar sync failing, key compromise, data breach (PDPA 3-day notification)
- **Exit criteria:** a pilot clinic runs for 2 weeks with no GraceSoft staff intervention; all M0/M1 tests pass in staging.

## M2 — Real Clinic Scheduling (4–5 weeks)

Moves from "one resource per business" (the current `AvailabilityService` limitation) to how clinics actually work.

- [ ] Practitioners and resources (doctors, rooms), each with their own hours, breaks, and leave
- [ ] Service rules: duration, buffer time, which practitioners offer it, new-patient-only or returning-only
- [ ] Booking windows: minimum notice, maximum days ahead, same-day cut-off
- [ ] Waitlist: auto-offer a freed slot to the next patient, with a timed hold
- [ ] No-show tracking and an optional policy (for example, require confirmation after 2 no-shows)
- [ ] Multiple locations under one business, with a shared patient identity and separate schedules
- [ ] Walk-in entry on the kiosk, so the queue reflects everyone in the room
- **Exit criteria:** a 3-doctor clinic with lunch breaks and leave schedules is modelled without workarounds.

## M3 — Self-Serve SaaS (4–6 weeks) · gate: *Paid beta*

A clinic can go from the marketing site to a live bot, and pay, without talking to GraceSoft.

- [ ] Public signup → business creation → owner account, replacing `seed:dev`
- [ ] Onboarding wizard v2: website crawl, document upload, vertical template, then a guided go-live checklist (channel connected, calendar connected, test booking made)
- [ ] Channel connection flows: WhatsApp embedded signup; Telegram bot connection with per-business webhook routing
- [ ] Billing with Stripe: plans, trial, card on file, invoices, metered Meta pass-through shown as its own line (pricing numbers from `pricingConfig.ts` finalised)
- [ ] Plan limits enforced in the API (practitioners, locations, messages)
- [ ] Marketing site: the demo app grows into the public site (home, pricing, privacy, signup, legal pages)
- [ ] Patient web booking page (no chat app needed) and a magic-link "manage my booking" page
- [ ] Internal ops console for GraceSoft: tenant list, health, billing status; no access to patient identity (see M4 break-glass)
- **Exit criteria:** 5 clinics complete signup to first real booking alone, in under 20 minutes median.

## M4 — Compliance and Trust (3–4 weeks, can overlap M3)

Turns the privacy architecture from a claim into something clinics and auditors can verify.

- [ ] Data subject requests: access export and deletion per patient, resolved by token, logged
- [ ] Audit log export (CSV/PDF) and a retention-policy settings UI for owners
- [ ] Break-glass support access: time-boxed, reason required, owner notified, fully audited
- [ ] Key rotation per business without downtime (re-wrap data keys)
- [ ] DPA signed during signup (e-sign), with a versioned sub-processor list
- [ ] External penetration test; findings fixed and retested
- [ ] PDPA review of 07-compliance-posture.md and 08-dpa-template.md by a lawyer; a Data Protection Officer contact published
- [ ] Security page on the marketing site, generated from the real controls
- **Exit criteria:** pen test has no open high or critical findings; a DSR round-trip is completed in staging in under 1 day.

## M5 — Scale, Insight and Reach (4–6 weeks) · gate: *GA*

- [ ] Owner analytics: bookings, after-hours coverage, no-show rate, and staff time saved, computed from aggregates only (no identity)
- [ ] Microsoft 365 / Outlook calendar sync
- [ ] Practice-management-system integration: whichever system pilot clinics actually use (see the Pilot Track in 01-milestones.md)
- [ ] Languages for SG: English, Simplified Chinese, Malay, Tamil in the bot, the booking page, and patient messages
- [ ] Accessibility: WCAG 2.2 AA on the patient booking page, the kiosk, and the admin app
- [ ] Load and cost: tested at 10× the beta tenant count; LLM and Meta costs per tenant monitored with alerts
- [ ] Status page and uptime SLO (for example 99.5%), with on-call alerting
- **Exit criteria:** all release-gate tests in the checklist pass; public signup is opened.

---

## Beyond GA (not scheduled)

- Second vertical (dental, physio, salons) using the blueprint template system
- AI triage limited to routing (no clinical advice), only after a clinical-safety review
- Payments or deposits at booking
- Regional expansion (MY, HK), each needing a new compliance review and data residency decision

## Sequencing notes

- **M0 comes first:** it's the gate for real data, and M1's WhatsApp and calendar work depends on real auth and a job queue.
- **M2 and M3 can swap** if pilot clinics are single-doctor but many clinics want to sign up.
- **M4's pen test needs the product to be feature-stable,** so schedule it after M3's feature freeze, not in parallel with big changes.
- **Pilot feedback overrides this document:** the calendar or practice-management system clinics actually use decides the M1/M5 integration order.
