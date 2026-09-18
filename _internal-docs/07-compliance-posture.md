# Concierge — Stated Compliance Posture

*Phase 2 deliverable (see [01-milestones.md](./01-milestones.md)). Extends the
architecture described in [05-privacy-spec.md](./05-privacy-spec.md) into a statement
usable in pitch conversations with pilot clinics and in the [DPA template](./08-dpa-template.md).*

**This is not a legal opinion or a certification.** It describes what the system does
technically and organizationally, and states which frameworks that behavior is
*aligned with*. None of the frameworks below have been through a formal third-party
audit or certification process. Before making a compliance claim to a real customer,
have this reviewed by qualified counsel in the relevant jurisdiction — see
["What this posture does not cover"](#what-this-posture-does-not-cover) below.

## Singapore — PDPA (Personal Data Protection Act)

Concierge's architecture is **aligned with** the PDPA's core obligations as follows:

| PDPA obligation | How the system addresses it |
| --- | --- |
| Purpose limitation | Calendar events and bookings carry only a token, service type, and time slot — never a name, phone number, or notes (`Booking`/`CalendarEventInput`, enforced at the type level). |
| Data minimization | The identity store (`Identity`) holds only name, phone, and optional notes — nothing beyond what's needed to contact a booker. |
| Protection obligation | Identity data is AES-256-GCM encrypted at rest, with one encryption key per business (`Business.encryptionKeyId`), stored in the platform secrets manager rather than the database. |
| Access/accountability | Every decryption of identity data requires an authenticated staff session, a stated reason, and writes an audit row (`TokenLookupAudit`) *before* returning data — see the token-lookup flow in 05-privacy-spec.md. |
| Retention limitation | A scheduled job (`RetentionService`) enforces per-business, configurable retention windows for both identity data and audit logs, with a grace period before hard deletion. |
| Notification/consent | **Not yet addressed in this codebase** — the actual booker-facing consent flow (what a booker is told when they first message the bot, and how they'd request deletion themselves) does not exist yet, because the booker-facing conversational flow itself (WhatsApp/Telegram bot) has not been built — see the note in 06-progress-log.md's 2026-09-18 entry. |

**Overall**: the *backend data architecture* is PDPA-aligned. The *end-to-end product*
is not yet PDPA-compliant, because the consent/notification surface a real booker would
interact with doesn't exist yet.

## Other markets — HIPAA-aligned framing

For businesses outside Singapore (or Singapore businesses serving patients where HIPAA
framing is commercially useful, e.g. talking to a US-linked healthcare group), the same
architecture maps onto several HIPAA Security Rule safeguards:

| HIPAA safeguard category | Alignment |
| --- | --- |
| Access control (§164.312(a)) | Role-gated staff sessions (`requireOwner`/`requireStaff`), business-scoped data access. |
| Audit controls (§164.312(b)) | `TokenLookupAudit` — every PHI-equivalent access logged with who/what/when/why. |
| Integrity (§164.312(c)) | Encrypted-at-rest storage; no code path writes identity data outside `IdentityService`. |
| Transmission security (§164.312(e)) | TLS termination via Cloudflare (infrastructure-level, not covered by this codebase — see 03-project-structure.md). |

**This is explicitly framing, not a HIPAA compliance certification.** HIPAA compliance
for a real covered entity or business associate requires a signed Business Associate
Agreement, a formal risk assessment, breach notification procedures, and workforce
training — none of which exist yet. Do not represent Concierge as "HIPAA compliant" to
a prospect; "HIPAA-aligned architecture, BAA available on request" is the accurate
framing until those pieces exist.

## What this posture does not cover

- **Booker-facing consent and self-service deletion** — not built (see the PDPA table
  above). This is the single largest gap between "the backend architecture is sound"
  and "the product is compliant end to end."
- **A signed BAA or DPA with any actual pilot clinic** — the [DPA template](./08-dpa-template.md)
  is a starting point, not an executed agreement.
- **Breach notification procedures** — no incident-response runbook exists yet.
- **Sub-processor list** — Railway (hosting), Cloudflare (edge/network), and whichever
  LLM provider is configured (`ANTHROPIC_API_KEY`) all process data on Concierge's
  behalf and would need to be disclosed to a business signing a DPA; formalize this list
  before sending any DPA for signature.
- **A completed data protection impact assessment (DPIA)** for the healthcare vertical
  specifically.

## Suggested pitch-conversation framing

> "Your booker's name and phone number are encrypted with a key unique to your clinic,
> and never touch the shared calendar your front desk uses — only an opaque token does.
> Every time a name is looked back up from a token, it's logged: who, when, and why.
> We're PDPA-aligned by design, and can share a technical spec and a draft DPA."

Avoid saying "HIPAA compliant" or "PDPA compliant" outright until the consent/deletion
gap above is closed and counsel has signed off — say "aligned with" instead.
