/**
 * Minimal dev-only seed: one business + one owner + one front-desk staff user, for
 * manually exercising the API against a real local Postgres (see .env.example).
 * Requires DATABASE_URL in the environment — run via:
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gracesoft_concierge?schema=public" node scripts/seed-dev.mjs
 */
import { PrismaClient } from "@gracesoft/db";

const db = new PrismaClient();

const business = await db.business.upsert({
  where: { id: "dev-business-1" },
  create: {
    id: "dev-business-1",
    name: "Dev Test Clinic",
    region: "SG",
    timezone: "Asia/Singapore",
    encryptionKeyId: "dev-business-key-1",
  },
  update: {},
});

const owner = await db.staffUser.upsert({
  where: { authSubject: "dev-owner-1" },
  create: { businessId: business.id, authSubject: "dev-owner-1", role: "owner" },
  update: {},
});

const frontDesk = await db.staffUser.upsert({
  where: { authSubject: "dev-frontdesk-1" },
  create: { businessId: business.id, authSubject: "dev-frontdesk-1", role: "front_desk" },
  update: {},
});

console.log(
  JSON.stringify({
    businessId: business.id,
    ownerAuthSubject: owner.authSubject,
    frontDeskAuthSubject: frontDesk.authSubject,
  }),
);
await db.$disconnect();
