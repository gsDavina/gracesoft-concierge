-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'front_desk');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'checked_in', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "BookingChannel" AS ENUM ('whatsapp', 'telegram', 'admin');

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Singapore',
    "encryptionKeyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_users" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "authSubject" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identities" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "encryptedName" TEXT NOT NULL,
    "encryptedPhone" TEXT NOT NULL,
    "encryptedNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scheduledDeletionAt" TIMESTAMP(3),

    CONSTRAINT "identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "channel" "BookingChannel" NOT NULL,
    "calendarEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_lookup_audit" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "lookedUpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_lookup_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_policies" (
    "businessId" TEXT NOT NULL,
    "identityRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "auditLogRetentionDays" INTEGER NOT NULL DEFAULT 730,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("businessId")
);

-- CreateIndex
CREATE UNIQUE INDEX "businesses_encryptionKeyId_key" ON "businesses"("encryptionKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_authSubject_key" ON "staff_users"("authSubject");

-- CreateIndex
CREATE INDEX "staff_users_businessId_idx" ON "staff_users"("businessId");

-- CreateIndex
CREATE INDEX "identities_businessId_scheduledDeletionAt_idx" ON "identities"("businessId", "scheduledDeletionAt");

-- CreateIndex
CREATE UNIQUE INDEX "identities_businessId_token_key" ON "identities"("businessId", "token");

-- CreateIndex
CREATE INDEX "bookings_businessId_token_idx" ON "bookings"("businessId", "token");

-- CreateIndex
CREATE INDEX "bookings_businessId_startsAt_idx" ON "bookings"("businessId", "startsAt");

-- CreateIndex
CREATE INDEX "token_lookup_audit_businessId_lookedUpAt_idx" ON "token_lookup_audit"("businessId", "lookedUpAt");

-- CreateIndex
CREATE INDEX "token_lookup_audit_identityId_idx" ON "token_lookup_audit"("identityId");

-- AddForeignKey
ALTER TABLE "staff_users" ADD CONSTRAINT "staff_users_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identities" ADD CONSTRAINT "identities_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_lookup_audit" ADD CONSTRAINT "token_lookup_audit_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_lookup_audit" ADD CONSTRAINT "token_lookup_audit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_lookup_audit" ADD CONSTRAINT "token_lookup_audit_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
