-- CreateEnum
CREATE TYPE "OnboardingSourceType" AS ENUM ('url', 'document');

-- CreateEnum
CREATE TYPE "OnboardingSourceStatus" AS ENUM ('pending', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "BlueprintStatus" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "onboarding_sources" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" "OnboardingSourceType" NOT NULL,
    "url" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "extractedText" TEXT,
    "status" "OnboardingSourceStatus" NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blueprints" (
    "businessId" TEXT NOT NULL,
    "status" "BlueprintStatus" NOT NULL DEFAULT 'draft',
    "services" JSONB NOT NULL DEFAULT '[]',
    "hours" JSONB NOT NULL DEFAULT '[]',
    "faqs" JSONB NOT NULL DEFAULT '[]',
    "generatedByLlm" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "publishedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blueprints_pkey" PRIMARY KEY ("businessId")
);

-- CreateIndex
CREATE INDEX "onboarding_sources_businessId_idx" ON "onboarding_sources"("businessId");

-- AddForeignKey
ALTER TABLE "onboarding_sources" ADD CONSTRAINT "onboarding_sources_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blueprints" ADD CONSTRAINT "blueprints_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
