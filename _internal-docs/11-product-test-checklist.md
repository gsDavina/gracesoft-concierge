# Concierge — Full Product Test Checklist

*Draft. What must be tested, and pass, before each release gate in
[10-product-milestones.md](./10-product-milestones.md). Each item is tagged with the
milestone that introduces it, for example **[M1]**. Automated items belong in CI; items
marked **(manual)** are run by a person before the release and recorded in the release notes.*

## How to use this

- **Per pull request:** sections U, I and C must pass in CI.
- **Per release to staging:** also E and P.
- **Per release gate:** everything tagged at or before that milestone, including the manual items.
- **Privacy invariants (section P) are never waived.** A failing P test blocks the release, whatever the deadline.

---

## P — Privacy invariants (the product's core promise)

- [ ] **[M0]** No `name`, `phone` or `notes` field can be written to `bookings` or to any calendar event (type-level test plus a database schema test)
- [ ] **[M0]** Decrypting identity always writes a `token_lookup_audit` row first; a test makes the audit insert fail and checks that no plaintext is returned
- [ ] **[M0]** Identity lookup without a stated reason is rejected
- [ ] **[M0]** Logs and error reports contain no PII: an integration test books with a known sentinel name/phone, then searches every log line and captured Sentry event for it
- [ ] **[M1]** Reminder, handoff and staff-notification messages contain no patient identity beyond what the channel already knows
- [ ] **[M1]** Google Calendar events created by sync contain only token, service and time; fields added by the clinic in Google are never copied into identity
- [ ] **[M3]** The GraceSoft ops console cannot reach any identity endpoint (route-level test for every console route)
- [ ] **[M4]** Retention job deletes identities past their window and leaves bookings tokenised; run against a time-shifted fixture
- [ ] **[M4]** A deletion DSR removes identity, channel identity and session state, and is itself audited
- [ ] **[M5]** Analytics queries run only on aggregates; a test fails if an analytics query touches the `identities` table

## S — Security

- [ ] **[M0]** A forged or unsigned session token is rejected on every authenticated route (tested across the full route table, not a sample)
- [ ] **[M0]** Tenant isolation: for every route taking a business id, a user of business A gets 403/404 for business B's resources (IDOR sweep)
- [ ] **[M0]** Row-level security: a raw database query run as the app role with business A set returns zero rows from business B
- [ ] **[M0]** Role checks: `front_desk` can't reach owner-only routes; `practitioner` can't unmask identities unless the policy allows it
- [ ] **[M0]** Encryption: each business's data can only be decrypted with that business's key; a ciphertext moved between tenants fails to decrypt
- [ ] **[M0]** Secrets: none in the repo, the build output, or client bundles (scan the Next.js bundles for key patterns)
- [ ] **[M0]** CORS only allows the configured admin origins in staging and production
- [ ] **[M1]** Webhooks: bad signature → 401; a replayed update is processed at most once; rate limit returns 429
- [ ] **[M1]** Chat input fuzzing: long, emoji, control characters and injection strings in the name/phone/free-text steps don't crash the bot or break state
- [ ] **[M3]** Signup abuse: rate limits, email verification, no business enumeration through error messages
- [ ] **[M3]** Stripe webhooks verified; a plan downgrade can't be bypassed by calling the API directly
- [ ] **[M4]** Key rotation leaves all existing identities decryptable; an old key is unusable afterwards
- [ ] **[M4]** Break-glass access is time-limited, requires a reason, notifies the owner, and is audited
- [ ] **[M4]** (manual) External penetration test: no open high or critical findings
- [ ] **[M4]** (manual) Dependency audit: no known high or critical vulnerabilities in production dependencies

## U — Unit tests (fast, no database)

- [ ] **[M0]** Contract schemas: valid and invalid payloads for every API request and response
- [ ] **[M0]** Crypto helpers: encrypt/decrypt round-trip, tamper detection (GCM auth tag), and envelope wrap/unwrap
- [ ] **[M1]** Conversation engine: every state transition, including `/cancel` mid-flow, an expired session, and an unknown input at each step
- [ ] **[M1]** Reminder scheduling: correct send times across time zones and DST (for non-SG tenants)
- [ ] **[M2]** Slot engine as pure functions: breaks, buffers, leave, multiple practitioners, minimum notice, maximum days ahead, holidays, overlapping bookings
- [ ] **[M2]** Waitlist: offer order, hold expiry, and a slot re-freed during a hold
- [ ] **[M3]** Plan limits and pricing calculation, including metered pass-through
- [ ] **[M5]** Translations: every message key exists in all 4 languages; placeholders match

## I — Integration tests (real Postgres through testcontainers, stubbed external services)

- [ ] **[M0]** Migrations apply cleanly to an empty database and to a copy of the previous release's schema
- [ ] **[M0]** Booking create/list/check-in through the API against a real database
- [ ] **[M1]** Full Telegram and WhatsApp booking conversation from recorded webhook fixtures, for a new booker and a returning booker
- [ ] **[M1]** Double-booking race: two concurrent requests for the last slot → exactly one succeeds
- [ ] **[M1]** Job queue: a failed job retries with backoff, then lands in a dead-letter queue with an alert; a restart doesn't run jobs twice
- [ ] **[M1]** Google Calendar sync against a recorded or stubbed API: create, update, delete, external event blocks the slot, token expiry and refresh
- [ ] **[M2]** A multi-practitioner clinic fixture produces the expected slot list for a full week
- [ ] **[M3]** Signup → onboarding → publish → first booking, end to end at the API level
- [ ] **[M3]** Stripe test mode: subscribe, upgrade, failed payment → grace period → suspension of the bot (not deletion of data)
- [ ] **[M4]** DSR export contains exactly one patient's data and nothing from other patients or tenants

## C — Contract and compatibility

- [ ] **[M0]** Frontends typecheck against `packages/contracts`; changing a contract breaks the build of every consumer that needs updating
- [ ] **[M1]** Webhook fixtures are refreshed from real Telegram and Meta payload samples every quarter
- [ ] **[M3]** Public API and webhook versions: an old client keeps working through one deprecation window

## E — End-to-end (Playwright against staging)

- [ ] **[M0]** Staff sign-in with MFA; sign-out; session expiry
- [ ] **[M1]** Admin: see a booking created through the bot; unmask an identity with a reason; see it in the audit log
- [ ] **[M1]** Kiosk: a booking appears in the queue; QR or short-code self check-in; the queue updates live on a second screen
- [ ] **[M2]** Owner sets up a practitioner with leave; the bot stops offering those days
- [ ] **[M3]** New clinic: signup → wizard → connect a test Telegram bot → test booking, in under 20 minutes
- [ ] **[M3]** Patient web booking and manage-booking magic link (reschedule, cancel)
- [ ] **[M4]** Owner exports the audit log and changes retention settings
- [ ] **[M5]** Each app in all 4 languages, and in light and dark mode

## A — Accessibility and UX

- [ ] **[M3]** Automated axe checks on every page of the admin, kiosk, patient booking page and marketing site (no serious or critical issues)
- [ ] **[M5]** (manual) Keyboard-only and screen-reader pass on the patient booking page and kiosk
- [ ] **[M5]** (manual) Kiosk usable on a 10-inch tablet at arm's length: touch targets, contrast, font size

## R — Reliability, performance and operations

- [ ] **[M0]** (manual) Restore production backup into a scratch database and verify row counts and decryptability, **at least quarterly**
- [ ] **[M1]** Health and readiness endpoints for the API and worker; the deploy fails if readiness fails
- [ ] **[M1]** (manual) Runbook drills: bot down, calendar sync failure, key compromise, and breach notification timing
- [ ] **[M5]** Load test: 10× beta tenant count, p95 webhook handling under 500 ms, no dropped updates
- [ ] **[M5]** Alerting: error rate, queue backlog, failed reminders, and LLM/Meta spend per tenant each trigger an alert in staging

## L — LLM features (onboarding extraction, and anything added later)

- [ ] **[M1]** Extraction runs on a fixed set of sample clinic websites and documents; output compared with expected blueprints (tracked score, not pass/fail on exact text)
- [ ] **[M1]** Fallback: when the LLM is unavailable or times out, the heuristic extractor is used and the owner is told
- [ ] **[M1]** No patient data is ever sent to the LLM (onboarding uses business material only); asserted by inspecting request payloads in tests
- [ ] **[M3]** Prompt injection in uploaded documents can't change the blueprint's structure or reach other tenants' data

---

## Release sign-off template

For each gate, copy this into the release notes:

```
Gate: ______   Date: ______   Commit: ______
[ ] All automated sections pass in CI for this commit
[ ] Manual items for this gate completed (list them, with who ran each)
[ ] Privacy invariants (P): all pass, none waived
[ ] Known issues accepted, with owner and due date:
Signed off by: ______
```
