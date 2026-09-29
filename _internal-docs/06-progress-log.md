# Concierge — Implementation Progress Log

Running log of what's been built against [01-milestones.md](./01-milestones.md), in
implementation order. Each entry says what was actually verified, not just written.

## 2026-09-11 — Monorepo scaffold + Phase 0 (Privacy Layer)

**Scaffolded** the monorepo per [03-project-structure.md](./03-project-structure.md):
pnpm workspaces + Turborepo, `packages/config` (shared eslint/tsconfig/prettier,
including the `admin-owner`/`admin-kiosk` import-boundary ESLint rule),
`packages/shared-types`, `packages/db` (Prisma), `packages/auth`, and `apps/api`
(Fastify). `apps/admin-owner` and `apps/admin-kiosk` directories exist but have no code
yet — next up.

**Implemented and verified** (Phase 0):
- Prisma schema: `Identity` (encrypted name/phone/notes) fully separate from `Booking`
  (token only), `StaffUser` (role mapping), `TokenLookupAudit`, `RetentionPolicy`,
  `Business.encryptionKeyId` (per-business key reference, not a stored key).
- AES-256-GCM field encryption (`apps/api/src/lib/crypto.ts`) — unit tested (round-trip,
  wrong-key failure, malformed-input rejection).
- `IdentityService.lookup` — authenticated actor + required reason, writes a
  `TokenLookupAudit` row *before* returning decrypted data.
- `RetentionService` — schedules identity deletion once all bookings under a token are
  terminal and past the business's retention window (with a 7-day grace period before
  hard delete), and purges audit rows past a separate audit retention window. Unit tested
  against a fake DB, then re-verified against a real local Postgres instance (migration
  applied, data seeded, job run, deletions confirmed).
- `CalendarAdapter` interface with an `InMemoryCalendarAdapter` for dev/tests — the
  interface's input type (`CalendarEventInput`) has no name/phone/notes field, so the
  "calendar never sees identity" guarantee is structural, not just a code-review
  convention.
- Fastify app (`apps/api`) wired end-to-end: `/bookings` (create/list),
  `/businesses/:businessId/identities/:token/lookup`, dev-only bearer-token auth
  (`DevSessionProvider`), role guards (`requireStaff`/`requireOwner`), typed error
  handler (401/403/400 mapped correctly — caught a bug here: unauthenticated requests
  were returning 500 until `registerErrorHandler` was added).
- End-to-end smoke test against a real local Postgres: created a business + staff user,
  created a booking (booking → in-memory "calendar" event → status `confirmed`), created
  an identity, looked it up through the HTTP route, confirmed the audit row was written,
  confirmed the raw DB row is ciphertext (not `"Jane Tan"`), confirmed an unauthenticated
  lookup is rejected with 401.
- Wrote [05-privacy-spec.md](./05-privacy-spec.md) — the Phase 0 sales-collateral
  deliverable.

**Deliberately not done yet** (needs accounts/credentials this environment cannot
create — flagged rather than faked):
- `GoogleCalendarAdapter` is a stub that throws — real Google Calendar OAuth needs a
  Google Cloud project and per-business OAuth credentials.
- `DevSessionProvider` is a base64-JSON bearer token, not real Clerk/Auth.js — needs a
  real auth provider account. `packages/auth`'s `SessionProvider` interface is the seam;
  swapping in a real driver won't require touching route code.
- Secrets manager (Railway secrets / Infisical) integration — `KeyProvider` interface is
  in place (`EnvKeyProvider` is the dev stand-in); production driver needs the actual
  secrets manager account.
- No CI workflow yet (GitHub Actions, per 03-project-structure.md).

**Verification commands** (for reference, not currently wired into CI):
```bash
pnpm --filter @gracesoft/api typecheck
pnpm --filter @gracesoft/api test
```

**Next up:** `apps/admin-owner` scaffolding, then Phase 1 (Onboarding Wizard).

## 2026-09-11 — `apps/admin-kiosk` (check-in queue frontend)

**Implemented and verified**:
- Added a `checkIn` capability to `BookingService`/`/bookings/check-in` (staff-authenticated,
  scoped to today's confirmed booking for a token) — the token doubling as the arrival
  credential the Pilot Track's check-in module calls for, without needing a name.
- `apps/admin-kiosk`: Next.js 14 app router, deliberately minimal kiosk-mode UI
  (large touch targets, no text selection, polls the queue every 15s). Shows only
  time/service/token — never a booker's name, matching the Phase 0 privacy boundary in
  the UI as well as the API.
- Added `@fastify/cors` to `apps/api`, scoped to the two admin frontend origins via a new
  `CORS_ORIGINS` env var.
- Dev-only sign-in page as the stand-in for real Clerk/Auth.js (same pattern as
  `DevSessionProvider` in apps/api).

**Verified in a real browser**, not just `next build`: ran a local Postgres, seeded a
business/staff user/three bookings, started `apps/api` and the kiosk dev server, signed
in, confirmed the live queue loaded from the API (2 waiting, 1 arrived), tapped "Check
in" on a waiting booking, confirmed it moved to "Arrived" in the UI, and confirmed the
underlying `bookings.status` row actually changed in Postgres (not just local UI state).

**Deliberately not done yet**: `apps/admin-owner` (blueprint editor, booking
history/analytics, settings, audit log, billing) — next up.

## 2026-09-11 — `apps/admin-owner` (bookings + restricted audit log)

**Implemented and verified**:
- `IdentityService.listAuditLog` + owner-only `GET /businesses/:businessId/audit-log` —
  a narrower privilege than the lookup itself (front-desk can look a token up; only
  owner can review who has been doing the looking up). Returns who/what/when/why, never
  decrypted identity data.
- `apps/admin-owner`: Next.js 14 app router, same dev-session pattern as admin-kiosk but
  seeded with the `owner` role. Two pages: a bookings table (all bookings, not just
  today — "Booking history / analytics" from 03-project-structure.md) and an audit-log
  page that also hosts the one UI-driven identity lookup (token + required reason →
  audit row appears in the table below immediately after).
- Verified with `next build` (typecheck + lint clean) and a real local Postgres +
  `apps/api` instance: seeded a business/owner/booking/identity, confirmed `/health` and
  the API came up correctly. Browser verification of the running admin-owner dev server
  was interrupted before completion — **not yet confirmed in a live browser**, unlike
  admin-kiosk. Re-run before trusting this page beyond "it builds and typechecks."

**Still open across both frontends**: no real auth provider (both use the same
`DevSessionProvider`-compatible localStorage session as apps/api's dev stand-in), no
blueprint editor, no settings page, no billing page — all out of scope for what's been
asked so far.

**Push status**: local commits are ahead of `origin/main`. Pushing is blocked — the
`gh` CLI here is authenticated as `davinaleong`, but the configured remote
(`github.com/gsDavina/gracesoft-concierge.git`) isn't visible to that account
(`git ls-remote` under both `davinaleong` and `gsDavina` returns "Repository not
found"). User chose to re-auth `gh` as `gsDavina`
(`gh auth login --hostname github.com --web`, run in an interactive terminal) — retry
the push once that's done.

*Resolved*: re-auth completed, `origin` now points at
`https://gsDavina@github.com/gsDavina/gracesoft-concierge.git` and all prior commits
are pushed.

## 2026-09-18 — Phase 1 kickoff: public-holiday auto-blocking

**Fixed a pre-existing bug before building on top of the auth model**: the `Role` type
in `packages/shared-types` used `"front-desk"` (hyphen) while the Prisma `Role` enum
uses `front_desk` (underscore). Nothing exercised the mismatch yet (the dev session
provider builds the actor client-side, it never round-trips through `StaffUser.role`),
but the new Blueprint/onboarding endpoints planned for the rest of Phase 1 are
owner-gated and will read roles from the DB, so this would have surfaced as a silent
`requireOwner`/`requireStaff` failure. Aligned `shared-types`, `packages/auth`, and the
one hardcoded dev-login value (`apps/admin-kiosk/src/app/login/page.tsx`) on
`front_desk` to match the DB enum, which is the source of truth.

**Implemented and verified** (Phase 1 — "Public-holiday auto-blocking added to
calendar/scheduling logic (by region)"):
- `HolidayProvider` interface (`apps/api/src/modules/holiday/holidayProvider.ts`) — same
  swappable-seam pattern as `CalendarAdapter`/`KeyProvider`.
- `NagerDateHolidayProvider` — the real, production default. Unlike Google Calendar,
  [Nager.Date](https://date.nager.at) is a free, keyless public-holiday API, so no
  OAuth/credentials gap here; region codes are ISO 3166-1 alpha-2, matching
  `Business.region` (e.g. `"SG"`) directly. Fails open (logs and returns no holidays)
  on a fetch error so a third-party outage can never block a real booking; caches
  results per region+year for the process lifetime.
- `StaticHolidayProvider` — in-memory table for tests/offline dev.
- `toLocalDateString()` — resolves a booking's local calendar date using
  `Business.timezone` via `Intl.DateTimeFormat`, not naive UTC slicing. Covered by a
  test that specifically picks a UTC timestamp that crosses midnight SGT
  (`2025-12-31T16:30:00Z` = `2026-01-01` in `Asia/Singapore`) to prove the timezone
  handling is real, not accidental.
- `BookingService.create()` now calls `assertNotOnHoliday()` before writing the booking
  row or touching the calendar adapter; throws the new `HolidayBlockedError` (mapped to
  HTTP 409 in `errorHandler.ts`) when the booking's local date matches a holiday for the
  business's region.
- New `GET /holidays?businessId&year` route (staff-authenticated, scoped to the actor's
  own business) so admin-owner (and the upcoming onboarding review step) can display
  which dates are auto-blocked, not just have bookings silently rejected on them.
- Unit tests: `apps/api/src/modules/booking/__tests__/bookingService.test.ts` (blocks a
  holiday date, allows a non-holiday date, resolves the date in local time not UTC)
  against a hand-rolled fake Prisma client, matching the existing `retentionService`
  test pattern. `pnpm --filter @gracesoft/api test` — 13/13 passing (3 new). `pnpm
  typecheck` — 9/9 tasks passing across all packages.

**Deliberately not done in this pass**: no admin-owner UI surfaces the `/holidays`
endpoint yet (no settings page exists to put it on — out of scope until the onboarding
wizard/settings work below). No retry/backoff on `NagerDateHolidayProvider` beyond the
in-process cache — acceptable for a fail-open, non-critical enhancement.

**Next up:** Phase 1's remaining three items (onboarding input step, LLM auto-draft,
human-in-the-loop review) — these share one new domain (a `Blueprint` + onboarding
document model, currently nonexistent in the schema) and will be built together as
"the onboarding wizard."

## 2026-09-18 — Onboarding wizard: input step, LLM auto-draft, human review/publish

Closes out the rest of Phase 1. All three remaining items share one new domain and were
built together.

**Schema** (`packages/db/prisma/schema.prisma`, migration `20260918050005_onboarding_wizard`,
generated and applied against a real local Postgres):
- `OnboardingSource` — one row per submitted URL or uploaded document; holds the
  extracted plain text actually fed to the LLM step (`extractedText`) plus a
  `pending`/`processed`/`failed` status and error message. The raw upload itself is never
  persisted, only the extracted text.
- `Blueprint` — one per business, `draft`/`published` status, `services`/`hours`/`faqs`
  as JSON (shapes defined in `packages/shared-types/src/blueprint.ts`), `generatedByLlm`
  flag, `publishedAt`/`publishedByStaffId`.

**Input step** (`apps/api/src/modules/onboarding/textExtraction.ts`):
- `extractTextFromUrl` — fetches a URL and strips it to visible text with a small
  regex-based HTML stripper (script/style/comment removal, tag stripping, entity
  decoding) rather than adding a cheerio/jsdom dependency for this.
- `extractTextFromDocument` — supports `text/plain` and `text/markdown` uploads only;
  anything else (PDF, Word) throws `UnsupportedDocumentFormatError` with a message
  naming what would be needed (pdf-parse/mammoth) rather than silently mishandling it —
  same "honest stub" pattern as `GoogleCalendarAdapter`.
- Both extraction paths are wrapped so failures land in `OnboardingSource.status =
  "failed"` with the error message, not a thrown request error — submitting a source
  that fails to parse is a normal, visible outcome, not a 500.
- New routes: `POST /businesses/:businessId/onboarding/sources/{url,document}` (the
  latter via `@fastify/multipart` — pinned to `^8.3.0`, since the installed default
  major requires Fastify 5 and this app is on Fastify 4), `GET .../onboarding/sources`.

**Auto-draft step** (`apps/api/src/modules/onboarding/llmProvider.ts`):
- `LlmProvider` interface — same swappable-seam pattern as `CalendarAdapter`/
  `HolidayProvider`.
- `AnthropicLlmProvider` — real implementation using `@anthropic-ai/sdk`
  (`claude-sonnet-5`), a strict JSON-only system prompt, and zod validation of the
  response shape; throws `LlmExtractionError` (mapped to HTTP 502) if the model output
  doesn't parse or match. Needs `ANTHROPIC_API_KEY` (added to `apps/api/.env.example` and
  `lib/env.ts`).
- `HeuristicLlmProvider` — the dev/no-key fallback. Not a mock: a real (if crude)
  keyword-based extractor (weekday + time-range lines -> hours, "?"-line + next line ->
  FAQ, recognizable listing lines -> services), so onboarding is fully usable end-to-end
  without any API key, just with lower-quality drafts. `buildApp()` picks
  `AnthropicLlmProvider` when `ANTHROPIC_API_KEY` is set, else `HeuristicLlmProvider`
  with a logged warning — same fallback pattern as the encryption-key/session-provider
  seams.
- `POST /businesses/:businessId/onboarding/draft` — gathers every `processed` source's
  extracted text for the business, calls the LLM provider, upserts the `Blueprint` as a
  fresh draft (`generatedByLlm: true`, clears any prior publish state). Throws
  `NoSourcesError` (400) if there's nothing processed yet.

**Human-in-the-loop review/edit + publish** (`OnboardingService` in
`onboardingService.ts`):
- `GET/PATCH /businesses/:businessId/blueprint` — owner reads/edits the draft content
  directly; a `PATCH` always sets `generatedByLlm: false` and clears publish state, so
  "this was LLM output, not yet reviewed" vs. "an owner has touched this" is always
  reconstructable from the row.
- `POST /businesses/:businessId/blueprint/publish` — go-live; records which staff member
  published and when.
- Every route in `routes/onboarding.ts` is owner-gated (`requireOwner`), matching the
  existing doc comment on `requireOwner` in `packages/auth` ("blueprint editing" was
  already named as an owner-only action before this work started).
- `apps/admin-owner`: new `/blueprint` page — URL/file submission form, a sources table
  with live status, a "Generate draft from sources" button, and an editable
  services/hours/FAQs form with Save/Publish actions. Added to `NavBar`.

**Bugs found and fixed during this work** (all pre-existing, surfaced by testing against
a real Postgres + real browser rather than just typechecking):
1. `packages/shared-types`' `Role` used `"front-desk"` (hyphen) while the Prisma enum
   uses `front_desk` (underscore) — see the 2026-09-18 Phase 1 kickoff entry above; fixed
   before this work started since the new owner-gated routes depend on role checks.
2. The admin-owner and admin-kiosk `lib/api.ts` `request()` helpers always sent
   `Content-Type: application/json`, even for body-less `POST`s (`generate draft`,
   `publish`) — Fastify's JSON body parser rejects an empty body sent with that header,
   so both no-argument POST actions 400'd. Fixed by only setting the header when
   `init.body` is present.
3. `apps/admin-owner/src/app/NavBar.tsx` read `localStorage` directly during render
   (`typeof window !== "undefined" ? loadDevSession() : null`), which always diverges
   from the server-rendered HTML (no `window` server-side) and threw a React hydration
   error on *every* page load, not just the new one — moved the read into a `useEffect`
   (same fix shape as the existing `useRequireSession` hook).

**Verified end-to-end**, not just typechecked:
- `pnpm typecheck` — 9/9 tasks. `pnpm --filter @gracesoft/api test` — 30/30 (11 new:
  `textExtraction.test.ts`, `llmProvider.test.ts` for `HeuristicLlmProvider`,
  `onboardingService.test.ts` against a hand-rolled fake Prisma client).
- Real local Postgres: applied the new migration, ran `apps/api` for real, seeded a
  business + owner (`apps/api/scripts/seed-dev.mjs`, new — kept as a committed dev
  convenience), and drove the full flow over HTTP with curl: uploaded a `.txt` doc,
  confirmed it was extracted and `processed`, generated a draft (via
  `HeuristicLlmProvider`, since no `ANTHROPIC_API_KEY` is configured in this
  environment), edited it, published it, then separately confirmed the holiday-blocking
  booking rejection from the previous entry still works against **live** Nager.Date data
  (not just the static test fixture) — `GET .../holidays?year=2026` for `region: "SG"`
  correctly returned 11 real 2026 Singapore public holidays, and a booking request on
  `2026-01-01` was rejected 409 while one on `2026-09-21` succeeded.
- Real browser (admin-owner dev server): signed in as the dev owner, navigated to
  `/blueprint`, submitted a URL source, generated a draft, hand-added a service, saved,
  and published — all through actual clicks/typing, not API calls. Caught bug #2 this
  way (draft generation 400'd) and bug #3 (hydration error, visible on every page, not
  just this one) by checking the browser console rather than only the visible UI.

**Deliberately not done in this pass**: no PDF/Word document parsing (flagged, not
faked — `UnsupportedDocumentFormatError` names what's missing). No public-holiday
display baked into the blueprint review UI yet (the `/holidays` endpoint exists but
nothing links to it from `/blueprint` — small follow-up, not go-live-blocking). No retry
UI for a failed source (the API supports resubmitting, the UI just doesn't have a
dedicated "retry" button — you can resubmit the same URL/file).

**Phase 1 is now fully checked off** in [01-milestones.md](./01-milestones.md). Next
up: Phase 2 (Healthcare Vertical Package) and Phase 3 (Trust Surface + Pricing) are
largely content/product decisions (a clinic FAQ template, DPA template, stated
compliance posture, pricing numbers) rather than pure engineering — flagging that before
starting, since several of those items need a business decision (what to charge, what
compliance claims to actually stand behind) that isn't mine to make unilaterally.

## 2026-09-18 — Phase 2 (Healthcare Vertical Package): 3 of 4 items

**Implemented and verified**:
- `CLINIC_BLUEPRINT_TEMPLATE` (`apps/api/src/modules/onboarding/verticalTemplates.ts`) —
  a pre-built GP-clinic starting point (4 services, standard weekly hours, 6 FAQs
  including insurance/payment, cancellation policy, confidentiality, and an explicit
  "no diagnosis/prescription through this chat" disclaimer). New owner-gated `GET
  /businesses/:businessId/vertical-templates/:name` route; new "Load GP clinic template"
  button on the `/blueprint` page loads it into the same editable draft state as an
  LLM-generated draft — an owner still has to review, edit, and explicitly publish it,
  same human-in-the-loop gate as everything else in Phase 1. Unit test
  (`verticalTemplates.test.ts`) validates the template against the same zod schema the
  LLM output is validated against, and checks the confidentiality/no-diagnosis FAQs are
  actually present (not just "some FAQs exist"). Verified in a real browser: clicked
  "Load GP clinic template," confirmed all 4 services / 7 weekday rows / 6 FAQs
  rendered, no console errors.
- [07-compliance-posture.md](./07-compliance-posture.md) — expands the one-paragraph
  compliance mention in 05-privacy-spec.md into PDPA and HIPAA-aligned-framing tables
  mapped to specific things this codebase actually does (encryption, audit logging,
  retention), explicitly states what's *not* covered (no booker-facing consent/
  self-service deletion flow exists yet — see the blocked item below), and gives
  suggested pitch-conversation language that says "aligned with," not "compliant."
- [08-dpa-template.md](./08-dpa-template.md) — a DPA template with the standard
  processor-obligation sections (sub-processors, breach notification, data-subject-
  rights assistance, audit rights), each mapped back to a real mechanism in the codebase
  where one exists, and clearly bracketed `[...]` where a real business/legal decision
  is still needed (entity names, jurisdiction, sub-processor confirmation, liability
  terms). **Both documents are explicitly marked as drafts requiring qualified legal
  review before use with a real clinic** — I'm not a lawyer and didn't attempt to write
  binding legal terms; I wrote a structured starting point mapped to this system's actual
  behavior, which is what "DPA template drafted" as an engineering-adjacent deliverable
  reasonably means.

**Left unchecked, deliberately** — "Booking flow copy adjusted for healthcare context
(confidentiality language, no diagnostic content)": there is no booker-facing
conversational flow to put this copy *in* yet. I checked — no WhatsApp/Telegram webhook
routes, no outbound-messaging module, nothing patient-facing exists anywhere in this
codebase; `apps/admin-kiosk` and `apps/admin-owner` are both staff-facing tools, not the
booking bot itself. Building a standalone "message templates" module with nothing to
consume it would be exactly the kind of speculative, unused abstraction I should avoid.
The confidentiality/no-diagnosis language this item is asking for **is already written**
in the clinic blueprint template's FAQs above, since that's the one place in the current
system where booker-facing healthcare-context copy actually lives — but the fuller
"booking flow copy" (bot conversation strings) can't be adjusted until the bot itself is
built. That's a materially larger undertaking (a real WhatsApp/Telegram integration) not
covered by any Phase 0/1 item that's actually been implemented, so I'm flagging the gap
rather than inventing an unused module to make the checkbox green.

**Verified**: `pnpm typecheck` 9/9, `pnpm --filter @gracesoft/api test` 32/32 (2 new).

Phase 2 is 3/4 checked off in [01-milestones.md](./01-milestones.md) — the remaining
item is blocked on work outside this session's scope, not skipped.

## 2026-09-18 — Phase 3 (Trust Surface + Pricing): new `apps/demo` app

**New service**: `apps/demo` (Next.js, port 3003) — the first genuinely public,
unauthenticated frontend in this repo. Added to `pnpm-workspace.yaml` (via the existing
`apps/*` glob, no change needed), `.claude/launch.json`, and
`03-project-structure.md`'s directory layout / deployment section (now four Railway
services, not three; noted that `demo` deliberately should *not* sit behind Cloudflare
Access the way the two admin frontends do).

**Interactive demo** (`/`): implements "book a slot -> show the resulting calendar event
with token instead of name" literally — a visitor fills in a demo booking (name, phone,
service, time) as if messaging the bot, then sees a side-by-side reveal: "what you told
us" vs. "what's written to the calendar," the latter rendered as the actual JSON shape
of `CalendarEventInput` (mirrored locally rather than imported from `apps/api`, since
frontends only import from `packages/`, never from another app). A "Simulate a staff
lookup" button appends a row to a small audit-log table, making the "every lookup is
logged" claim from 05-privacy-spec.md tangible rather than just asserted. Entirely
client-side — no network calls, nothing persisted, safe to point cold-outreach traffic
at without touching production data.

**Pricing page** (`/pricing`): itemized flat-fee + Meta-pass-through-cost structure. The
user was asked how to handle the actual numbers and chose "placeholder numbers, clearly
marked TBD" over guessing real figures or skipping the page. All figures live in one
config file
(`apps/demo/src/lib/pricingConfig.ts`), so filling in real numbers later never requires
touching the page component. The page renders a visible "Draft — not for external use"
banner whenever any figure is still a placeholder, and the Meta rate field intentionally
has no hardcoded dollar amount (only a pointer to Meta's own pricing calculator) since
WhatsApp Business Platform per-conversation rates vary by country/category and change
over time — a wrong guess here would be actively misleading in a way "TBD" is not.

**Bug found and fixed during verification**: the "what you told us" / "what's written to
the calendar" comparison used an inline two-column CSS grid with no responsive
breakpoint, which overflowed horizontally on a 375px mobile viewport (checked because a
cold-outreach demo link is realistically opened on a phone at least as often as a
desktop). Fixed by moving that layout into a `.comparison-grid` class in `globals.css`
with a `max-width: 640px` media query that collapses to one column; verified both
desktop and mobile (375×812) renders after the fix.

**Verified**: `pnpm typecheck` 10/10 across all 8 packages (`@gracesoft/demo` is new).
Real browser: submitted a demo booking, confirmed the token-only calendar JSON renders
correctly, triggered the simulated audit-log entry, checked both pages at desktop and
mobile width, and confirmed no console errors on either page.

Phase 3 is fully checked off in [01-milestones.md](./01-milestones.md), with the caveat
that the pricing page's numbers are placeholders — **not send-to-a-real-prospect ready
until someone fills in `apps/demo/src/lib/pricingConfig.ts` with actual figures.**

## 2026-09-18 — Assessment: Phase 4 and most of the Pilot Track are blocked

Before starting Phase 4 (Telegram Expansion), I checked what it would actually be
extending. Grepped the whole `apps/api/src` tree for anything webhook/conversation/
channel-related: nothing. No WhatsApp or Telegram webhook route, no conversation/session
state of any kind, and no slot-availability concept at all —
`BookingService.create()` (apps/api/src/modules/booking/bookingService.ts) takes an
exact ISO `startsAt`/`endsAt`, there is no "list the open times for this service" query
anywhere for a chat flow (or anything else) to offer a booker.

**What this means**: the actual booking bot — the WhatsApp/Telegram conversational
surface a patient would message to book an appointment, which is what "Concierge" as a
product is nominally about — has not been built. Everything implemented across Phases
0–3 (the privacy layer, the onboarding wizard, both admin frontends, the trust-surface
demo) is real, working, and correctly wired to each other, but it's all *supporting*
infrastructure that assumes a conversational front door exists. It doesn't yet.

This wasn't skipped or missed — no milestone checklist item in Phase 0 or Phase 1 asked
for it (Phase 1's four items are all about the onboarding *wizard*, not the bot itself;
03-project-structure.md lists "WhatsApp webhook" and "Telegram webhook" as things
`apps/api` is *responsible for* eventually, not as a Phase 0/1 deliverable). Phase 4's
premise ("Telegram channel adapter reusing the same wizard, privacy layer, and vertical
package") is written as if a WhatsApp bot is already live and Telegram is just a second
surface on top of it — that premise doesn't hold yet.

**Why I stopped instead of building a Telegram adapter anyway**: a channel adapter with
no real conversation logic and no availability system behind it would be a hollow stub —
it would technically produce a file named "Telegram adapter" without doing anything a
prospect or pilot clinic could use, which is exactly the kind of half-finished,
unrequested-scope work I should avoid rather than manufacture to turn a checkbox green.
Building the *real* thing (a working conversational booking bot, for at least one
channel) is a substantial, multi-part undertaking of its own — roughly comparable in
size to everything built so far combined — and touches decisions that aren't mine to
make unilaterally:

- **Channel choice for the first real integration**: Telegram is the easier one to
  actually stand up and test end-to-end (a bot token from @BotFather requires no
  business verification, unlike Meta's WhatsApp Cloud API, which needs a Meta Business
  account and app review — the same kind of credentials gap already blocking
  `GoogleCalendarAdapter`). Building Telegram first, even though WhatsApp is nominally
  "primary" elsewhere in the docs, might be the pragmatic move — but that's a real
  product-sequencing call.
- **A slot-availability system** would need to be designed and built first (or as part
  of the same effort) — there's currently no way for a chat flow to say "here are the
  open 15-minute slots for General Consultation this week," only a raw
  "create a booking at this exact time" primitive.
- **Conversation/session state** design (how much of the flow is button-driven vs.
  free text, how state persists between messages) is itself a real design decision, not
  a mechanical extension of existing code.

**Also affects Phase 2's remaining item** ("Booking flow copy adjusted for healthcare
context") from the 2026-09-18 Phase 2 entry above — same root cause, now confirmed with
a full-repo grep rather than a spot check.

**Also affects most of the Pilot Track** — several of its remaining items (learning the
clinic's workflow, sending an introductory note, running a pilot, capturing metrics) are
outreach/relationship actions for the founder, not engineering tasks an agent can
perform regardless of what's built. But "run a free, parallel pilot" specifically also
now has a technical blocker: there's nothing pilotable yet without the base
conversational bot.

**I'm asking the user, rather than deciding, whether to scope and build a real
conversational booking bot next** (and if so, for which channel first) — this is a
large enough chunk of new work, with real product-sequencing implications, that it
deserves an explicit decision rather than an autonomous one. See the message sent
alongside this commit.

**User's decision**: build it now, Telegram first.

## 2026-09-18 — Phase 4: the actual Telegram booking bot

**New data model**: `ChannelIdentity` (maps a Telegram chat id to the same opaque token
used everywhere else, so a returning booker isn't asked for their name/phone again — the
*only* place a channel-native user id is stored; `Identity`/`Booking` still never see
it) and `TelegramSession` (per-chat conversation state, since a webhook handler is
stateless between HTTP requests). Migration `20260918053326_telegram_bot`, generated
and applied against the real local Postgres.

**New `AvailabilityService`** (`apps/api/src/modules/booking/availabilityService.ts`) —
the missing piece identified in the blocker writeup above: turns a business's
*published* Blueprint (hours + services) into actual bookable slots.
`listOpenDates()` walks the next 7 days, keeping ones the business is open on
(per-weekday hours) and not a public holiday (reuses the exact same `HolidayProvider`
from Phase 1 — no duplicated holiday logic). `listSlots()` generates candidate start
times stepped by the chosen service's `durationMinutes` (default 30) and excludes any
that overlap an existing non-cancelled booking. New `zonedTimeToUtc()`
(`apps/api/src/lib/timezone.ts`) converts a business-local wall-clock date+time into
the correct UTC instant using only `Intl.DateTimeFormat` (no date library dependency),
mirroring the dependency-light approach already used for `toLocalDateString`.
**Deliberate simplification, stated in the module's doc comment**: one booking blocks
that time across the *entire* business regardless of service — there's no
doctor/room/resource concept in the schema, so this only really fits a single-provider
clinic. A multi-doctor clinic would need a resource dimension added before this scales
past a solo-GP pilot.

**Telegram bot** (`apps/api/src/modules/telegram/`):
- `TelegramClient` interface, same swappable-seam pattern as every other external
  dependency in this codebase. `TelegramBotApiClient` is the real implementation (plain
  HTTPS calls to `api.telegram.org` — the Bot API needs no SDK). `LoggingTelegramClient`
  is the no-token fallback (logs instead of sending), so the entire conversation flow is
  testable — including via a simulated webhook POST against a real Postgres — without a
  real bot account, the same "GoogleCalendarAdapter-style honest stub" pattern used
  throughout this codebase.
- `TelegramBotService` — the actual conversation: `/book` -> pick a service (buttons,
  from the published Blueprint) -> pick a date (buttons, from `AvailabilityService`) ->
  pick a time (buttons) -> if this chat has booked before, book immediately using their
  existing token; if not, ask for name then phone, create an `Identity` +
  `ChannelIdentity`, then book. `/cancel` resets. Re-validates the chosen slot is still
  free immediately before booking (a second `listSlots` call) to catch a race against
  another booker taking the same time between the button tap and the final message.
  Catches `HolidayBlockedError` from `BookingService` specifically (shouldn't happen
  since slots are pre-filtered, but defensive) vs. any other failure, and — a bug I
  found and fixed while testing — **every non-holiday booking failure is now reported
  to an injected `onError` callback** wired to `app.log.error` in production; the first
  version of this code swallowed the real error entirely, which would have made a real
  production bug invisible behind a generic "something went wrong" message to the
  booker with nothing in the logs to debug from.
- `POST /webhooks/telegram` — public and unauthenticated by necessity (Telegram calls
  it directly), protected by verifying Telegram's `X-Telegram-Bot-Api-Secret-Token`
  header against `TELEGRAM_WEBHOOK_SECRET`; refuses all traffic (404) if that secret or
  `TELEGRAM_BUSINESS_ID` (which business this bot instance serves — one bot per
  business, a pilot-scale simplification stated in the service's doc comment) isn't
  configured, rather than silently accepting unverified calls. Always acks 200 quickly
  and logs (doesn't throw) on a handling failure, since Telegram retries a webhook that
  doesn't ack fast.
- New env vars (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BUSINESS_ID`)
  added to `lib/env.ts` and `.env.example`. New
  `apps/api/scripts/telegram-set-webhook.mjs` — the one-time `setWebhook` call needed
  to point a real bot at a deployment, once a real token and public URL exist.

**Bug found and fixed while writing tests, not just while running the app**: the
first test-fake `db.booking.create()` omitted `createdAt`/`updatedAt`, which
`BookingService`'s real `toBookingDto()` needs — surfaced as a generic "something went
wrong" failure message with no detail, specifically *because* the error was being
swallowed (see above). Fixing the error-swallowing bug first is what made the actual
fake-db bug visible instead of a silent false negative.

**Verified**:
- `pnpm --filter @gracesoft/api test` — 40/40 passing (10 new:
  `availabilityService.test.ts` covers slot generation, overlap exclusion, closed days,
  no-published-blueprint, and open-dates skipping both closed weekdays and holidays;
  `telegramBotService.test.ts` simulates three full conversations — a brand-new
  booker through every step, a returning booker skipping straight to time selection,
  and `/cancel` mid-flow — against a hand-rolled fake Prisma client and a fake
  `TelegramClient` that records every message/buttons sent). `pnpm typecheck` — 10/10.
- **Real end-to-end, not just unit tests**: seeded a business via
  `scripts/seed-dev.mjs`, published the Phase 2 clinic blueprint template through the
  real onboarding API, ran `apps/api` for real against local Postgres, and drove the
  actual webhook endpoint with curl exactly as Telegram would call it: `/book` ->
  tapped "General Consultation" -> tapped a date -> tapped a 15-minute-stepped time slot
  (confirmed the step size came from the service's real `durationMinutes: 15`) ->
  answered name "Priya Kumar" -> answered a phone number -> got the confirmation
  message. Then queried Postgres directly and confirmed: the `bookings` row has only
  token/service/time/status/channel — no name; the `identities` row's `encryptedName`
  column is genuine ciphertext, not "Priya Kumar" in the clear; `channel_identities`
  correctly maps the simulated chat id to that same token. Ran the flow a second time
  for the same simulated chat id and confirmed it skipped straight from time-selection
  to a confirmed booking with no name/phone prompt, reusing the same token. Confirmed
  the webhook returns 401 for a missing or wrong secret-token header. Cleaned up all
  seeded/test data afterward.

**Still needs, to actually go live** (stated plainly, not glossed over): a real
Telegram bot token from @BotFather (this environment cannot create one — same kind of
account-creation gap as `GoogleCalendarAdapter`'s Google Cloud project), a publicly
reachable HTTPS URL for the webhook (a real deployment, or a tunnel for testing), and
running `telegram-set-webhook.mjs` once both exist.

Phase 4 is checked off in [01-milestones.md](./01-milestones.md) as "built," with that
go-live caveat stated clearly rather than implied.

## 2026-09-18 — Closing the loop: Phase 2's last item, unblocked by Phase 4

The one remaining Phase 2 item — "Booking flow copy adjusted for healthcare context
(confidentiality language, no diagnostic content)" — was left unchecked earlier today
specifically because there was no conversational flow to put that copy *in*. Now there
is one. Revisited it rather than leaving it stale.

**What I didn't do**: hardcode healthcare-specific strings ("we can't diagnose you",
etc.) into `TelegramBotService`'s core conversation logic. Concierge is a multi-vertical
product — baking clinic-specific disclaimers into the generic booking flow would be
wrong for a non-healthcare business using the same bot code.

**What I did instead**: added a `/faq` (and `/help`) command that surfaces the
business's own *published* Blueprint FAQs as buttons — the exact healthcare-context
copy (confidentiality, "no diagnosis through this chat", emergency guidance) already
written into `CLINIC_BLUEPRINT_TEMPLATE` back in the Phase 2 entry above is now
reachable by a real booker, for any business that has that content in its blueprint,
not just healthcare ones. `AvailabilityService.listPublishedFaqs()` is the new read
path (same "published blueprint" pattern as `listPublishedServices`). Also added one
generically-true privacy line (not healthcare-specific — it's just what the Phase 0
architecture actually does) to the first-time-booker name prompt: "Your name and phone
number are stored securely and kept separate from the appointment calendar — see /faq
for more," and pointed to `/faq` from the welcome, fallback, and booking-confirmation
messages so it's discoverable. `/faq` deliberately doesn't touch in-progress booking
session state, so asking a question mid-booking doesn't lose your place — tested
explicitly.

**Verified**: `pnpm --filter @gracesoft/api test` — 44/44 (4 new: `listPublishedFaqs`
returns published FAQs / empty list without a published blueprint;
`TelegramBotService` lists FAQs and answers the one tapped, and confirmed `/faq`
mid-booking doesn't disrupt the in-progress flow). `pnpm typecheck` — 10/10.

**Unrelated but worth recording**: partway through this work, a system notice reported
that `01-milestones.md` had been overwritten on disk with entirely unrelated content —
a different, unrelated project's milestones file (something called
`davdevs-assistant`, a Telegram-bridge tool for Claude Code hooks — not anything in
this repo or its history). I stopped and verified with `git diff`/`git status` before
touching anything further; by the time I checked, the file already matched the last
commit again, so nothing was actually lost, and no commit of mine ever contained that
content. Flagged to the user directly rather than silently continuing — this looked
like a different, unrelated Claude Code session briefly writing to the same file path
by coincidence, though the exact cause is unconfirmed.

**Phase 2 is now fully checked off** in [01-milestones.md](./01-milestones.md) — all
four items, no remaining blockers. Combined with Phases 0, 1, 3, and 4 all being
checked off too, every checklist item that is actually an engineering/content task has
now been completed. What remains across the whole document is exclusively: (a) real
pricing numbers (a business decision, deliberately left as placeholders per the user's
choice), and (b) the Pilot Track's outreach/relationship items, which require the
founder's direct action with a real clinic and cannot be performed by an engineering
agent.

## 2026-09-29 — UI polish, brand assets, and per-day opening-hours slots

On branch `ui-polish-branding`.

**Admin and Kiosk redesign.** The two staff apps were hard to tell apart. Admin
(`apps/admin-owner`) is now a back-office console: a Purple 950 sidebar (`AppShell.tsx`
replaces the old top `NavBar.tsx`), dense 14px type, cards, tables and status badges,
with inline styles moved into shared classes in `globals.css`. Kiosk (`apps/admin-kiosk`)
is now a touch screen: a purple header band with a live clock, large tickets and
buttons, and a Waiting / Arrived board. Its Waiting, Arrived and Next up tiles are
colour-coded purple, green and amber; Admin's booking tiles use thin coloured borders
that match the status badges. The kiosk also gained a Sign out button.

**Brand assets.** Header wordmarks now use the white exports (`wm-a-w.svg`,
`wm-k-w.svg`, `wm-d-w.svg`) and favicons use the originals (`logo-a.svg`, `logo-k.svg`,
`logo-d.svg`), copied into each app's `public/` — see [04-assets.md](./04-assets.md).
Known issue: the demo's white wordmark sits on the page background, so it's invisible
in light mode.

**Local database setup (not a code change).** Every database-backed page returned 500.
Cause: `apps/api/.env`'s `DATABASE_URL` had no password, and the `gracesoft_concierge`
database had never been created. Fixed locally by adding the password, running
`prisma migrate deploy` and `seed:dev`. The README's getting-started steps now call this
out.

**Opening hours as time slots.** `BlueprintHours` gained `slots: { opens, closes }[]`, so
a day can have several bookable ranges (for example 09:00–12:00 and 13:00–17:00 for a
lunch break). The old single `opens`/`closes` pair is still read as one slot, so older
blueprints, the clinic template and LLM drafts keep working without a migration. The
Blueprint editor adds and removes slots per day and blocks saving backwards or
overlapping slots.

**Bookings must fit inside a slot.** New `apps/api/src/lib/businessHours.ts` is shared by
`AvailabilityService` and `BookingService`. `BookingService.create()` now rejects, for
every channel, any booking that doesn't fit entirely inside one published slot
(`OutsideOpeningHoursError`, HTTP 409). Before this, only the Telegram bot's slot picker
respected hours; `POST /bookings` accepted any time. With Monday 09:00–17:00, a 1-hour
booking can start from 09:00 to 16:00. A business with no published blueprint is not
restricted, as before. This is business-wide; per-practitioner hours and leave remain
M2 work in [10-product-milestones.md](./10-product-milestones.md).

**Verified**: `pnpm --filter @gracesoft/api test` — 52/52 (8 new: booking-hours
enforcement, including split days, closed days, legacy hours and end-before-start, and
multi-range availability). Typecheck passes for api, admin-owner and admin-kiosk.
Against the running API, with Monday 09:00–12:00 / 13:00–17:00: 1-hour bookings at
09:00, 13:00 and 16:00 were accepted; 08:00, 11:30, 12:00, 16:30 and a Tuesday 20:00
were rejected with 409.

**Clarified, not changed**: bookings made on the demo page never reach the API, by
design — it's a client-only simulation for sales, so they will never appear in Admin or
Kiosk. The kiosk also only shows today's bookings.

**Housekeeping**: removed `02-test-cheklist.md`, an older copy of
[01-milestones.md](./01-milestones.md) that nothing linked to, and added an index at
[`_internal-docs/README.md`](./README.md). `pnpm --filter @gracesoft/api lint` fails
because `eslint` isn't installed in that package; this predates today's work.
