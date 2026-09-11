# Concierge — Technical Privacy Spec

*One-page summary of the Phase 0 privacy architecture. Written to double as sales collateral for pilot clinics — see [01-milestones.md](./01-milestones.md).*

## The problem

A booking bot that talks to WhatsApp/Telegram necessarily sees a booker's name, phone
number, and sometimes free-text notes ("running 10 min late", "first visit"). A calendar
system that a whole front-desk team can see does not need to hold any of that — it only
needs to know *when* and *what service*. Concierge keeps those two concerns in separate
stores so a compromised or over-shared calendar never leaks who booked what.

## Architecture

```
Booker (WhatsApp/Telegram)
        │
        ▼
  apps/api  ──────────────►  identities table   (encrypted, per-business key)
        │                     name / phone / notes, keyed by `token`
        │
        └──────────────────►  bookings table     (token only)
                               service type / time slot / status
                                     │
                                     ▼
                         Google Calendar event
                         (token, service type, time slot — nothing else)
```

- **Identity store**: `identities` (name/phone/notes, AES-256-GCM encrypted at rest, one
  key per business).
- **Booking store**: `bookings` — token, service type, time slot, status. No name, phone,
  or notes field exists on this table; it structurally cannot leak identity.
- **Calendar writes**: the calendar adapter's write method takes a token/service/time
  input type — again, there is no field to accidentally pass a name through.
- **The only bridge** between a token and a person is the identity lookup flow.

## Token-lookup flow

Turning a token back into a name/phone requires:
1. An authenticated staff session (owner or front-desk role).
2. A stated reason for the lookup.
3. A `token_lookup_audit` row written *before* the decrypted data is returned — logging
   who looked up which token, when, and why.

There is no code path that decrypts identity data without writing that audit row first.

## Per-business encryption keys

Each business has its own AES-256 key (`Business.encryptionKeyId`), stored in the
platform secrets manager rather than in the database. A key or database compromise for
one business does not expose another's bookers. Key rotation is per-business and does
not require touching other tenants' data.

## Retention and deletion

A scheduled job (`RetentionService`, run daily) enforces two independently configurable,
per-business retention windows (`RetentionPolicy`):

- **Identity retention** — once every booking under a token is in a terminal state
  (`completed`/`cancelled`) and the most recent one is older than the business's
  configured window, the identity is marked for deletion with a 7-day grace period, then
  hard-deleted.
- **Audit log retention** — lookup audit rows are purged past a separate, longer-lived
  window, so "who looked up what" stays available for a compliance review even after the
  underlying identity is gone.

This is enforced in code (`apps/api/src/modules/retention`), not left as a policy
document — see the deletion job's own test suite for the behaviors covered.

## Compliance posture

PDPA-aligned for Singapore-based businesses (data minimization, purpose-limited access,
enforced retention). HIPAA-aligned framing is available for other markets but not yet
formally assessed — see Phase 2 (Healthcare Vertical Package) for the DPA template and
stated compliance posture.

## What this spec does not cover

Transport security (TLS termination via Cloudflare), infrastructure access control
(Cloudflare Access gating the admin frontends), and secrets-manager operational details
are covered in [03-project-structure.md](./03-project-structure.md), not here.
