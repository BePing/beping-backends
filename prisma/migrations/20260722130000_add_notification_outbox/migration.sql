CREATE TYPE "NotificationOutboxType" AS ENUM (
  'PLAYER_RANKING_UPDATED',
  'RESULT_UPDATED'
);

CREATE TYPE "NotificationOutboxStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'PROCESSED',
  'FAILED'
);

CREATE TABLE "NotificationOutbox" (
  "id" TEXT NOT NULL,
  "type" "NotificationOutboxType" NOT NULL,
  "deduplicationKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "NotificationOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationOutbox_deduplicationKey_key"
  ON "NotificationOutbox"("deduplicationKey");
CREATE INDEX "NotificationOutbox_status_availableAt_idx"
  ON "NotificationOutbox"("status", "availableAt");
CREATE INDEX "NotificationOutbox_type_createdAt_idx"
  ON "NotificationOutbox"("type", "createdAt");

ALTER TABLE "DeviceSubscription" ALTER COLUMN "locale" SET DEFAULT 'fr';
