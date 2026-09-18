-- CreateTable
CREATE TABLE "channel_identities" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "channel" "BookingChannel" NOT NULL,
    "channelUserId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_sessions" (
    "chatId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_sessions_pkey" PRIMARY KEY ("chatId")
);

-- CreateIndex
CREATE INDEX "channel_identities_businessId_token_idx" ON "channel_identities"("businessId", "token");

-- CreateIndex
CREATE UNIQUE INDEX "channel_identities_businessId_channel_channelUserId_key" ON "channel_identities"("businessId", "channel", "channelUserId");

-- AddForeignKey
ALTER TABLE "channel_identities" ADD CONSTRAINT "channel_identities_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
