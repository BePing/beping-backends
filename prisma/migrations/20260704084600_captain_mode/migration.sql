-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('PRESENT', 'ABSENT', 'PENDING');

-- CreateEnum
CREATE TYPE "ResponseSource" AS ENUM ('PLAYER', 'CAPTAIN_OVERRIDE');

-- CreateEnum
CREATE TYPE "LineupStatus" AS ENUM ('A_FAIRE', 'BROUILLON', 'VALIDEE');

-- CreateEnum
CREATE TYPE "SlotRole" AS ENUM ('TITULAIRE', 'BANC', 'RENFORT_MONTANT');

-- CreateEnum
CREATE TYPE "ConvocationStatus" AS ENUM ('CONFIRMED', 'DECLINED', 'PENDING');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CAPTAIN_AVAILABILITY_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'CAPTAIN_CONVOCATION';
ALTER TYPE "NotificationType" ADD VALUE 'CAPTAIN_LINEUP_REMINDER';

-- CreateTable
CREATE TABLE "CaptainAccount" (
    "id" TEXT NOT NULL,
    "uniqueIndex" INTEGER NOT NULL,
    "clubIndex" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "ranking" TEXT,
    "lastVerifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaptainAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityPoll" (
    "id" TEXT NOT NULL,
    "matchUniqueId" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "clubIndex" TEXT NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityResponse" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "uniqueIndex" INTEGER NOT NULL,
    "status" "AvailabilityStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "source" "ResponseSource" NOT NULL DEFAULT 'PLAYER',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lineup" (
    "id" TEXT NOT NULL,
    "matchUniqueId" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "clubIndex" TEXT NOT NULL,
    "status" "LineupStatus" NOT NULL DEFAULT 'A_FAIRE',
    "forceSnapshot" JSONB,
    "validation" JSONB,
    "overrideJustification" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineupSlot" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "uniqueIndex" INTEGER NOT NULL,
    "orderPos" INTEGER NOT NULL,
    "role" "SlotRole" NOT NULL DEFAULT 'TITULAIRE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineupSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Convocation" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "matchUniqueId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "meetingTime" TEXT,
    "venue" TEXT,
    "publicToken" TEXT NOT NULL,
    "sentBy" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Convocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConvocationResponse" (
    "id" TEXT NOT NULL,
    "convocationId" TEXT NOT NULL,
    "uniqueIndex" INTEGER NOT NULL,
    "status" "ConvocationStatus" NOT NULL DEFAULT 'PENDING',
    "source" "ResponseSource" NOT NULL DEFAULT 'PLAYER',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConvocationResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaptainAccount_uniqueIndex_key" ON "CaptainAccount"("uniqueIndex");

-- CreateIndex
CREATE INDEX "CaptainAccount_clubIndex_idx" ON "CaptainAccount"("clubIndex");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityPoll_matchUniqueId_key" ON "AvailabilityPoll"("matchUniqueId");

-- CreateIndex
CREATE INDEX "AvailabilityPoll_clubIndex_idx" ON "AvailabilityPoll"("clubIndex");

-- CreateIndex
CREATE INDEX "AvailabilityPoll_teamId_idx" ON "AvailabilityPoll"("teamId");

-- CreateIndex
CREATE INDEX "AvailabilityResponse_uniqueIndex_idx" ON "AvailabilityResponse"("uniqueIndex");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityResponse_pollId_uniqueIndex_key" ON "AvailabilityResponse"("pollId", "uniqueIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Lineup_matchUniqueId_key" ON "Lineup"("matchUniqueId");

-- CreateIndex
CREATE INDEX "Lineup_clubIndex_idx" ON "Lineup"("clubIndex");

-- CreateIndex
CREATE INDEX "Lineup_teamId_idx" ON "Lineup"("teamId");

-- CreateIndex
CREATE INDEX "LineupSlot_lineupId_idx" ON "LineupSlot"("lineupId");

-- CreateIndex
CREATE UNIQUE INDEX "LineupSlot_lineupId_uniqueIndex_key" ON "LineupSlot"("lineupId", "uniqueIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Convocation_lineupId_key" ON "Convocation"("lineupId");

-- CreateIndex
CREATE UNIQUE INDEX "Convocation_matchUniqueId_key" ON "Convocation"("matchUniqueId");

-- CreateIndex
CREATE UNIQUE INDEX "Convocation_publicToken_key" ON "Convocation"("publicToken");

-- CreateIndex
CREATE INDEX "ConvocationResponse_uniqueIndex_idx" ON "ConvocationResponse"("uniqueIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ConvocationResponse_convocationId_uniqueIndex_key" ON "ConvocationResponse"("convocationId", "uniqueIndex");

-- AddForeignKey
ALTER TABLE "AvailabilityResponse" ADD CONSTRAINT "AvailabilityResponse_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "AvailabilityPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupSlot" ADD CONSTRAINT "LineupSlot_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "Lineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convocation" ADD CONSTRAINT "Convocation_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "Lineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvocationResponse" ADD CONSTRAINT "ConvocationResponse_convocationId_fkey" FOREIGN KEY ("convocationId") REFERENCES "Convocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
