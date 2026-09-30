/**
 * Demo content seed: a fictitious Singapore beauty salon, "GraceSoft Beauty", with a
 * published blueprint (services, opening hours, FAQs) and an owner + front-desk user —
 * so Admin, Kiosk, the demo page and the Telegram bot all have realistic content.
 *
 * Idempotent: safe to re-run. Re-running OVERWRITES the blueprint with the content below,
 * so edits made in Admin to this business are lost — edit this file instead.
 *
 * Run from apps/api (loads apps/api/.env):
 *   pnpm seed:beauty
 *
 * Point the demo at it with NEXT_PUBLIC_DEMO_BUSINESS_ID=gracesoft-beauty.
 *
 * Modelling notes (current system limits, see 10-product-milestones.md M2):
 * - One set of hours per business — there's no "outlet" concept yet, so this models a
 *   single flagship outlet.
 * - One booking blocks the whole business at that time (no per-therapist capacity).
 * - Singapore public holidays are auto-blocked for every business, so the FAQ below says
 *   online booking is closed on public holidays even though real salons often open.
 */
import { PrismaClient } from "@gracesoft/db";

const BUSINESS_ID = "gracesoft-beauty";
const ENCRYPTION_KEY_ID = "gracesoft-beauty-key-1";
const OWNER = "beauty-owner-1";
const FRONT_DESK = "beauty-frontdesk-1";

/**
 * Mall-style hours: open daily, no lunch closure (therapists take staggered breaks).
 * `closes` is when the last appointment must END — bookings must fit inside a slot, so a
 * 90-minute lash set must start by 19:30. Note the slot picker steps in increments of the
 * service's own length, so it actually offers that service at 11:00, 12:30 … 18:30.
 */
const WEEKDAY = [{ opens: "11:00", closes: "21:00" }];
const WEEKEND = [{ opens: "10:00", closes: "21:00" }];
const hours = [
  { day: "monday", slots: WEEKDAY },
  { day: "tuesday", slots: WEEKDAY },
  { day: "wednesday", slots: WEEKDAY },
  { day: "thursday", slots: WEEKDAY },
  { day: "friday", slots: WEEKDAY },
  { day: "saturday", slots: WEEKEND },
  { day: "sunday", slots: WEEKEND },
].map((h) => ({ ...h, closed: false }));

/** Indicative Singapore pricing, before GST. Blueprint services have no price field yet. */
const services = [
  // Facials
  { name: "Skin Consultation", durationMinutes: 15, description: "Complimentary skin analysis and treatment plan for first-time clients." },
  { name: "Express Glow Facial", durationMinutes: 30, description: "Cleanse, exfoliate and hydrating mask for a quick refresh. From S$58." },
  { name: "Signature Hydrating Facial", durationMinutes: 60, description: "Our bestseller: deep hydration with facial massage and LED therapy. From S$98." },
  { name: "Acne Clarifying Facial", durationMinutes: 75, description: "Deep cleanse with gentle extractions and a calming blue-light finish. From S$128." },
  { name: "Brightening Vitamin C Facial", durationMinutes: 60, description: "Targets dullness and uneven tone with a vitamin C infusion. From S$118." },

  // Brows & lashes
  { name: "Brow Shaping", durationMinutes: 15, description: "Threading or waxing to shape and tidy brows. From S$18." },
  { name: "Brow Tint", durationMinutes: 20, description: "Semi-permanent tint for fuller-looking brows. Patch test required. From S$25." },
  { name: "Lash Lift & Tint", durationMinutes: 60, description: "Lifts and darkens natural lashes; lasts 6–8 weeks. Patch test required. From S$88." },
  { name: "Classic Lash Extensions", durationMinutes: 90, description: "One extension per natural lash for a natural, defined look. From S$128." },
  { name: "Lash Extension Refill", durationMinutes: 60, description: "Top-up within 3 weeks of a full set. From S$68." },

  // Nails
  { name: "Classic Manicure", durationMinutes: 30, description: "Shape, cuticle care and regular polish. From S$25." },
  { name: "Gel Manicure", durationMinutes: 60, description: "Long-wear gel colour, lasts 2–3 weeks. From S$48." },
  { name: "Gel Pedicure", durationMinutes: 60, description: "Foot soak, scrub and long-wear gel colour. From S$58." },
  { name: "Gel Removal", durationMinutes: 20, description: "Gentle soak-off removal of gel polish. From S$15." },

  // Waxing
  { name: "Underarm Waxing", durationMinutes: 15, description: "From S$22." },
  { name: "Full Leg Waxing", durationMinutes: 45, description: "From S$68." },
  { name: "Brazilian Waxing", durationMinutes: 30, description: "Performed by our senior therapists. From S$58." },

  // Body
  { name: "Back & Shoulder Massage", durationMinutes: 45, description: "Relieves tension in the neck, shoulders and upper back. From S$78." },
];

const faqs = [
  {
    question: "How far in advance should I book?",
    answer:
      "Weekday afternoons usually have same-day availability. Evenings and weekends fill up fast, so we recommend booking 3–5 days ahead.",
  },
  {
    question: "What is your cancellation policy?",
    answer:
      "Please give at least 24 hours' notice to cancel or reschedule. Late cancellations or no-shows may be charged 50% of the treatment price, or deducted from your package.",
  },
  {
    question: "What happens if I'm running late?",
    answer:
      "We'll do our best to fit you in, but your treatment may be shortened so the next client isn't delayed. If you're more than 15 minutes late, we may need to reschedule.",
  },
  {
    question: "Do I need a patch test?",
    answer:
      "Yes, for brow tints and lash lifts or extensions if it's your first time with us. Book a quick patch test at least 48 hours before your appointment.",
  },
  {
    question: "Are your treatments suitable during pregnancy?",
    answer:
      "Many are, but some facials, massages and waxing aren't recommended. Let us know when you book and your therapist will suggest pregnancy-safe options.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "PayNow, NETS, Visa, Mastercard and American Express. Prices shown are before GST.",
  },
  {
    question: "Do you offer packages?",
    answer:
      "Yes. Packages of 5 or 10 sessions for facials, lash refills and gel manicures save up to 20%. Ask your therapist at your next visit.",
  },
  {
    question: "Can men book treatments?",
    answer: "Absolutely. All our facials, brow shaping, waxing and massages are available to everyone.",
  },
  {
    question: "Are you open on public holidays?",
    answer:
      "Online booking is closed on Singapore public holidays. Please call us directly for public-holiday appointments.",
  },
  {
    question: "Is my personal information kept private?",
    answer:
      "Yes. Your name and phone number are stored encrypted and separately from our appointment calendar, which only shows a booking reference. Staff can only see who a booking belongs to with a recorded reason.",
  },
];

const db = new PrismaClient();

const business = await db.business.upsert({
  where: { id: BUSINESS_ID },
  create: {
    id: BUSINESS_ID,
    name: "GraceSoft Beauty",
    region: "SG",
    timezone: "Asia/Singapore",
    encryptionKeyId: ENCRYPTION_KEY_ID,
  },
  update: { name: "GraceSoft Beauty" },
});

const owner = await db.staffUser.upsert({
  where: { authSubject: OWNER },
  create: { businessId: business.id, authSubject: OWNER, role: "owner" },
  update: {},
});

const frontDesk = await db.staffUser.upsert({
  where: { authSubject: FRONT_DESK },
  create: { businessId: business.id, authSubject: FRONT_DESK, role: "front_desk" },
  update: {},
});

const content = { status: "published", services, hours, faqs, generatedByLlm: false };
await db.blueprint.upsert({
  where: { businessId: business.id },
  create: { businessId: business.id, ...content, publishedAt: new Date(), publishedByStaffId: owner.id },
  update: { ...content, publishedAt: new Date(), publishedByStaffId: owner.id },
});

console.log(
  JSON.stringify(
    {
      businessId: business.id,
      ownerAuthSubject: owner.authSubject,
      frontDeskAuthSubject: frontDesk.authSubject,
      services: services.length,
      faqs: faqs.length,
    },
    null,
    2,
  ),
);

// Identity lookups and Telegram bookings for this business need its own key.
let hasKey = false;
try {
  hasKey = Boolean(JSON.parse(process.env.GRACESOFT_DEV_ENCRYPTION_KEYS ?? "{}")[ENCRYPTION_KEY_ID]);
} catch {
  // Malformed JSON — reported below as a missing key.
}
if (!hasKey) {
  console.warn(
    `\nNote: GRACESOFT_DEV_ENCRYPTION_KEYS has no "${ENCRYPTION_KEY_ID}" entry. Bookings and ` +
      "identity lookups that store patient details for this business will fail until you add one. " +
      "Generate a key with:\n  node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
  );
}

await db.$disconnect();
