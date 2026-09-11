# Concierge — Milestones

Sequenced so each phase de-risks the next. Vertical assumed: healthcare (GP clinic pilot). Swap freely if the target vertical changes.

## Phase 0 — Privacy Layer (2–3 weeks)
Foundational; goes first even though it's less visible than the wizard.

- [x] Separate booker-identity store from calendar-write path (`identities` table, encrypted, vs. `bookings` table with token only)
- [x] Calendar events write only: token, service type, time slot — never name/phone/notes *(enforced at the type level via `CalendarEventInput`; real Google Calendar OAuth wiring still pending — see [06-progress-log.md](./06-progress-log.md))*
- [x] Token-lookup flow: authenticated, logged (who looked up what, when)
- [x] Retention/deletion policy written **and implemented** as an actual scheduled job
- [x] Per-business encryption keys (not one global key)
- **Deliverable:** one-page technical privacy spec, usable as sales collateral — see [05-privacy-spec.md](./05-privacy-spec.md)

## Phase 1 — Onboarding Wizard (3–5 weeks)
Removes manual setup as the growth bottleneck.

- [ ] Input step: business submits website URL and/or uploads docs (services, hours, FAQs)
- [ ] Auto-draft: LLM extracts blueprint content from submitted material
- [ ] Human-in-the-loop review/edit step before go-live
- [ ] Public-holiday auto-blocking added to calendar/scheduling logic (by region)
- **Target:** signup → working bot in under 20 minutes, trending toward under 10
- **Deliverable:** self-serve onboarding flow, no manual blueprint authoring required

## Phase 2 — Healthcare Vertical Package (parallel with Phase 1, 2–4 weeks)

- [ ] Pre-built blueprint template for clinic FAQs (insurance, appointment types, cancellation policy)
- [ ] Booking flow copy adjusted for healthcare context (confidentiality language, no diagnostic content)
- [ ] DPA template drafted
- [ ] Stated compliance posture (PDPA-aligned for Singapore; HIPAA-aligned framing if targeting other markets)
- **Deliverable:** pitch-ready vertical package for first 3–5 pilot clinics

## Phase 3 — Trust Surface + Pricing (1–2 weeks, can overlap with Phase 2)

- [ ] Interactive demo: book a slot → show the resulting calendar event with token instead of name
- [ ] Pricing page: flat platform fee + itemized estimated Meta pass-through cost
- **Deliverable:** demo and pricing page ready for cold outreach

## Phase 4 — Telegram Expansion (after Phases 1–3 are stable)

- [ ] Telegram channel adapter reusing the same wizard, privacy layer, and vertical package
- **Rationale:** low-competition wedge, upside rather than urgent

---

## Pilot Track — GP Clinic (runs alongside the phases above)

- [ ] Learn the clinic's actual workflow (volume, after-hours gaps, staff time spent on registration)
- [ ] Quantify the pain (estimated staff-hours/week lost to manual registration)
- [ ] Confirm what calendar/practice-management system the clinic actually uses
- [ ] Send a low-pressure introductory note (not pitched during a clinical visit)
- [ ] Scope and build the **check-in module** (token reused as arrival credential — see Phase 0/1 dependencies)
- [ ] Run a free, parallel (non-disruptive) pilot
- [ ] Capture before/after metrics (staff time, wait time, after-hours coverage) for a case study
- [ ] Turn the pilot into a referenceable case study for outreach to the next 20–30 clinics

---

## Sequencing Notes

- If solo: do Phase 0 before Phase 1 — the wizard is meaningless without a privacy architecture worth marketing.
- If two builders: Phase 0 and Phase 1 can run in parallel.
- Aim to have pilot clinics engaged by end of Phase 2, to validate the vertical bet with real users before investing further in Phase 3 polish.