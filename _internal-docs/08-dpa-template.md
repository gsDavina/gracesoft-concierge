# Concierge — Data Processing Agreement (Template)

*Phase 2 deliverable (see [01-milestones.md](./01-milestones.md)). Companion to
[05-privacy-spec.md](./05-privacy-spec.md) and [07-compliance-posture.md](./07-compliance-posture.md).*

> **This is a drafting starting point, not a ready-to-sign legal document, and not legal
> advice.** Have qualified counsel review and adapt it — for the specific jurisdiction,
> the specific clinic's requirements, and current PDPA/HIPAA text — before sending it to
> any real pilot clinic for signature. Bracketed `[...]` fields must be filled in per
> deal; anything not bracketed is a suggested default, not a fixed term.

---

## Data Processing Agreement

This Data Processing Agreement ("**DPA**") is entered into between:

- **[Clinic legal entity name]** ("**Controller**"), and
- **[Concierge operating entity name]** ("**Processor**"),

(together, the "**Parties**") and forms part of the Concierge Terms of Service /
Master Services Agreement dated **[date]** (the "**Agreement**") between the Parties.

### 1. Subject matter and duration

1.1 Processor provides Controller with a booking-management platform (WhatsApp/Telegram
booking bot, calendar integration, and front-desk/admin tooling) ("**Services**").

1.2 This DPA governs Processor's processing of personal data on Controller's behalf in
connection with the Services, for the duration of the Agreement.

### 2. Nature and purpose of processing

Processor processes personal data solely to:

- Receive and confirm appointment bookings via WhatsApp and/or Telegram;
- Resolve a booking token back to a booker's identity, at Controller staff's request,
  for legitimate operational purposes (e.g. confirming who is checking in);
- Send booking-related notifications (confirmations, reminders, cancellations);
- Enforce Controller's configured data-retention policy.

Processor does **not** process personal data for any other purpose, including marketing,
profiling, or training general-purpose models on Controller's data, without Controller's
separate written consent.

### 3. Categories of data subjects and personal data

**Data subjects**: Controller's patients/clients who book appointments through the
Services ("**Bookers**").

**Categories of personal data**:

| Category | Where it's stored | Notes |
| --- | --- | --- |
| Name | `identities` table, encrypted | Never stored on a booking or calendar record. |
| Phone number | `identities` table, encrypted | Used for WhatsApp/Telegram messaging and confirmation. |
| Free-text notes (e.g. "running late") | `identities` table, encrypted, optional | Only if the Booker provides it. |
| Appointment metadata (service type, time slot, status) | `bookings` table, **not encrypted, not identity-linked beyond an opaque token** | See 05-privacy-spec.md. |

Processor does **not** knowingly process health/diagnostic information as part of the
Services — the Services book appointment *slots*, not diagnoses, symptoms, or treatment
details. [Confirm with Controller whether any booker-submitted free text is intended to
ever contain health information; if so, this DPA and the underlying data classification
need updating before go-live.]

### 4. Processor's obligations

Processor shall:

4.1 Process personal data only on Controller's documented instructions (including
regarding cross-border transfers), unless required otherwise by law;

4.2 Ensure persons authorized to process personal data (Processor's staff/contractors)
are bound by confidentiality obligations;

4.3 Implement the technical and organizational measures described in
[05-privacy-spec.md](./05-privacy-spec.md), including: per-business AES-256 encryption
of identity data, authenticated and audited identity lookups, and enforced retention/
deletion windows;

4.4 Assist Controller, to the extent reasonably possible, in responding to data subject
requests (access, correction, deletion) and in fulfilling Controller's own obligations
under applicable law (e.g. PDPA notification obligations, or a HIPAA-covered entity's
breach notification obligations if applicable);

4.5 Notify Controller without undue delay (target: **within 72 hours** of becoming
aware) of any personal data breach affecting Controller's data, including known scope
and remediation steps taken;

4.6 At the end of the Agreement, at Controller's election, delete or return all personal
data, except where retention is required by law;

4.7 Make available to Controller information reasonably necessary to demonstrate
compliance with this DPA, and allow for audits (including inspections) on reasonable
notice, no more than **[once per 12 months]** absent a suspected breach.

### 5. Sub-processors

Processor may engage the following sub-processors as of the effective date:

| Sub-processor | Purpose | Location |
| --- | --- | --- |
| **[Railway]** | Application hosting, database | **[region — confirm Singapore availability]** |
| **[Cloudflare]** | Edge network, DDoS protection, TLS termination | Global edge network |
| **[Anthropic]** (only if `ANTHROPIC_API_KEY` is configured for this Controller) | LLM-assisted blueprint drafting from Controller-submitted business content (not booker personal data) | **[confirm data-processing terms with sub-processor]** |

Processor shall notify Controller of any intended change to this list and give
Controller the opportunity to object on reasonable grounds, per **[X days']** notice.

[This list must be verified and finalized — it is a placeholder based on the platforms
named in 03-project-structure.md, not a confirmed, reviewed sub-processor list.]

### 6. International transfers

[Fill in once hosting region is finalized. If Railway/Cloudflare infrastructure used for
a given Controller is entirely within Singapore, state that; if not, this section needs
an appropriate transfer mechanism — e.g. PDPA-compliant transfer safeguards, or Standard
Contractual Clauses if EU/UK data subjects are ever in scope, which is not currently
expected for this product.]

### 7. Data subject rights assistance

Where a Booker exercises a data-subject right (access, correction, deletion, objection)
directly against Controller, Processor shall provide reasonable assistance to fulfill
that request, including:

- Confirming what data is held for a given booking token (via the existing token-lookup
  flow, which already requires authentication and logs the access);
- Executing a deletion request ahead of the normal retention schedule, where legally
  required.

**Known gap** (see [07-compliance-posture.md](./07-compliance-posture.md)): there is no
self-service mechanism yet for a Booker to request this directly through the bot — all
such requests currently have to go through Controller's staff. Flag this to Controller
before signature so expectations are set correctly.

### 8. Liability and indemnification

[Standard commercial terms — defer to counsel. Typical DPA provisions cap Processor's
liability under the DPA at the liability cap in the main Agreement, and require
Processor to indemnify Controller for Processor's own breach of this DPA's obligations.]

### 9. Term and termination

This DPA remains in effect for as long as Processor processes personal data on
Controller's behalf under the Agreement, and survives termination of the Agreement to
the extent Processor continues to hold Controller's personal data (e.g. during the
retention window before scheduled deletion).

---

**Signature blocks, governing law, and dispute resolution**: intentionally omitted —
these must match the main Agreement's terms and require counsel input.
