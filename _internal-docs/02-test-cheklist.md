# Concierge — Milestones

Sequenced so each phase de-risks the next. Vertical assumed: healthcare (GP clinic pilot). Swap freely if the target vertical changes.

## Phase 0 — Privacy Layer (2–3 weeks)
Foundational; goes first even though it's less visible than the wizard.

- [x] Separate booker-identity store from calendar-write path (`identities` table, encrypted, vs. `bookings` table with token only)
- [x] Calendar events write only: token, service type, time slot — never name/phone/notes
- [x] Token-lookup flow: authenticated, logged (who looked up what, when)
- [x] Retention/deletion policy written **and implemented** as an actual scheduled job
- [x] Per-business encryption keys (not one global key)
- **Deliverable:** one-page technical privacy spec, usable as sales collateral — see [05-privacy-spec.md](./05-privacy-spec.md)

## Phase 1 — Onboarding Wizard (3–5 weeks)
Removes manual setup as the growth bottleneck.

- [x] Input step: business submits website URL and/or uploads docs (services, hours, FAQs) — see [06-progress-log.md](./06-progress-log.md)
- [x] Auto-draft: LLM extracts blueprint content from submitted material — see [06-progress-log.md](./06-progress-log.md)
- [x] Human-in-the-loop review/edit step before go-live — see [06-progress-log.md](./06-progress-log.md)
- [x] Public-holiday auto-blocking added to calendar/scheduling logic (by region) — see [06-progress-log.md](./06-progress-log.md)
- **Target:** signup → working bot in under 20 minutes, trending toward under 10
- **Deliverable:** self-serve onboarding flow, no manual blueprint authoring required

## Phase 2 — Healthcare Vertical Package (parallel with Phase 1, 2–4 weeks)

- [x] Pre-built blueprint template for clinic FAQs (insurance, appointment types, cancellation policy) — see [06-progress-log.md](./06-progress-log.md)
- [ ] Booking flow copy adjusted for healthcare context (confidentiality language, no diagnostic content) — blocked, see 01-milestones.md
- [x] DPA template drafted — see [08-dpa-template.md](./08-dpa-template.md)
- [x] Stated compliance posture (PDPA-aligned for Singapore; HIPAA-aligned framing if targeting other markets) — see [07-compliance-posture.md](./07-compliance-posture.md)
- **Deliverable:** pitch-ready vertical package for first 3–5 pilot clinics

## Phase 3 — Trust Surface + Pricing (1–2 weeks, can overlap with Phase 2)

- [x] Interactive demo: book a slot → show the resulting calendar event with token instead of name — see [06-progress-log.md](./06-progress-log.md)
- [x] Pricing page: flat platform fee + itemized estimated Meta pass-through cost — structure built, real numbers still TBD
- **Deliverable:** demo and pricing page ready for cold outreach

## Phase 4 — Telegram Expansion (after Phases 1–3 are stable)

- [ ] Telegram channel adapter reusing the same wizard, privacy layer, and vertical package
- **Rationale:** low-competition wedge, upside rather than urgent
- **Blocked** — no base conversational booking bot exists for any channel yet; see 01-milestones.md and 06-progress-log.md.

---

## Pilot Track — GP Clinic (runs alongside the phases above)

- [ ] Learn the clinic's actual workflow — not implementable by an engineering agent, needs a real clinic conversation
- [ ] Quantify the pain — same
- [ ] Confirm what calendar/practice-management system the clinic actually uses — same
- [ ] Send a low-pressure introductory note — same, an outreach action, not code
- [x] Scope and build the **check-in module** (token reused as arrival credential — see Phase 0/1 dependencies) — see [06-progress-log.md](./06-progress-log.md)
- [ ] Run a free, parallel (non-disruptive) pilot — needs a real clinic + the base conversational bot
- [ ] Capture before/after metrics for a case study — needs real pilot data
- [ ] Turn the pilot into a referenceable case study — needs real pilot data

---

## Sequencing Notes

- If solo: do Phase 0 before Phase 1 — the wizard is meaningless without a privacy architecture worth marketing.
- If two builders: Phase 0 and Phase 1 can run in parallel.
- Aim to have pilot clinics engaged by end of Phase 2, to validate the vertical bet with real users before investing further in Phase 3 polish.