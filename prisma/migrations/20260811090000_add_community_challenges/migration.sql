-- CreateEnum
CREATE TYPE "ChallengeRunType" AS ENUM ('SUNDAY_PRESS_DRAFT', 'MONDAY_PRESS_FINAL');

-- CreateEnum
CREATE TYPE "ChallengeRunStatus" AS ENUM ('RUNNING', 'COMPUTED', 'PRESS_SENT', 'READY_FOR_PUBLICATION', 'PUBLISHED', 'FAILED', 'DELIVERY_UNKNOWN');

-- CreateEnum
CREATE TYPE "ChallengePressDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'UNKNOWN');

-- AlterEnum
ALTER TYPE "NotificationOutboxType" ADD VALUE 'CHALLENGE_PUBLISHED';

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "description" TEXT,
    "unofficial" BOOLEAN NOT NULL DEFAULT true,
    "unofficialLabel" TEXT NOT NULL DEFAULT 'Classement non officiel',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "pressEmailSubject" TEXT,
    "pressEmailBody" TEXT,
    "integrationConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeSecretReference" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "envVarName" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeSecretReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeSeason" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Brussels',
    "sundayRunTime" TEXT NOT NULL DEFAULT '18:00',
    "mondayRunTime" TEXT NOT NULL DEFAULT '20:00',
    "thursdayPublishTime" TEXT NOT NULL DEFAULT '08:00',
    "pressRankingLimit" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeRule" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,

    CONSTRAINT "ChallengeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeRegion" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChallengeRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeClub" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "clubIndex" TEXT NOT NULL,
    "clubName" TEXT,

    CONSTRAINT "ChallengeClub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeLevel" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChallengeLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeDivision" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "divisionId" INTEGER NOT NULL,

    CONSTRAINT "ChallengeDivision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengePointOverride" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerUniqueIndex" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "victoryCount" INTEGER,
    "forfeit" INTEGER,
    "reason" TEXT,

    CONSTRAINT "ChallengePointOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeExcludedPlayer" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerUniqueIndex" INTEGER NOT NULL,
    "reason" TEXT,

    CONSTRAINT "ChallengeExcludedPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengePressRecipient" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChallengePressRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeChampionshipWeek" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "championshipSunday" DATE NOT NULL,
    "mondayRunDate" DATE NOT NULL,
    "thursdayPublishDate" DATE NOT NULL,
    "source" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeChampionshipWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeRun" (
    "id" TEXT NOT NULL,
    "championshipWeekId" TEXT NOT NULL,
    "type" "ChallengeRunType" NOT NULL,
    "status" "ChallengeRunStatus" NOT NULL DEFAULT 'RUNNING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "sourceVersion" TEXT NOT NULL,
    "checksum" TEXT,
    "totalPlayers" INTEGER NOT NULL DEFAULT 0,
    "totalRankings" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computedAt" TIMESTAMP(3),
    "pressSentAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeRanking" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "playerUniqueIndex" INTEGER NOT NULL,
    "playerName" TEXT NOT NULL,
    "clubIndex" TEXT NOT NULL,
    "clubName" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "regionLabel" TEXT NOT NULL,
    "levelCode" TEXT NOT NULL,
    "levelLabel" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "totalParticipants" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "count5Pts" INTEGER NOT NULL DEFAULT 0,
    "count3Pts" INTEGER NOT NULL DEFAULT 0,
    "count2Pts" INTEGER NOT NULL DEFAULT 0,
    "count1Pts" INTEGER NOT NULL DEFAULT 0,
    "count0Pts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengePlayerPoint" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "playerUniqueIndex" INTEGER NOT NULL,
    "matchUniqueId" INTEGER NOT NULL,
    "matchId" TEXT NOT NULL,
    "divisionId" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "levelCode" TEXT NOT NULL,
    "victoryCount" INTEGER NOT NULL,
    "forfeit" INTEGER NOT NULL,
    "pointsWon" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengePlayerPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeRegionSummary" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "regionLabel" TEXT NOT NULL,
    "totalPlayers" INTEGER NOT NULL,
    "playersByLevel" JSONB NOT NULL,
    "clubs" TEXT[],
    "aiSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeRegionSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengePressDelivery" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "status" "ChallengePressDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengePressDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengePublication" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "championshipWeekId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengePublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_slug_key" ON "Challenge"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeSecretReference_challengeId_key_key" ON "ChallengeSecretReference"("challengeId", "key");

-- CreateIndex
CREATE INDEX "ChallengeSeason_season_active_idx" ON "ChallengeSeason"("season", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeSeason_challengeId_season_key" ON "ChallengeSeason"("challengeId", "season");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeRule_seasonId_key_key" ON "ChallengeRule"("seasonId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeRegion_seasonId_code_key" ON "ChallengeRegion"("seasonId", "code");

-- CreateIndex
CREATE INDEX "ChallengeClub_regionId_idx" ON "ChallengeClub"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeClub_seasonId_clubIndex_key" ON "ChallengeClub"("seasonId", "clubIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeLevel_seasonId_code_key" ON "ChallengeLevel"("seasonId", "code");

-- CreateIndex
CREATE INDEX "ChallengeDivision_levelId_idx" ON "ChallengeDivision"("levelId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeDivision_seasonId_divisionId_key" ON "ChallengeDivision"("seasonId", "divisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengePointOverride_seasonId_playerUniqueIndex_week_key" ON "ChallengePointOverride"("seasonId", "playerUniqueIndex", "week");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeExcludedPlayer_seasonId_playerUniqueIndex_key" ON "ChallengeExcludedPlayer"("seasonId", "playerUniqueIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengePressRecipient_seasonId_email_key" ON "ChallengePressRecipient"("seasonId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeChampionshipWeek_seasonId_week_key" ON "ChallengeChampionshipWeek"("seasonId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeChampionshipWeek_seasonId_championshipSunday_key" ON "ChallengeChampionshipWeek"("seasonId", "championshipSunday");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeChampionshipWeek_seasonId_mondayRunDate_key" ON "ChallengeChampionshipWeek"("seasonId", "mondayRunDate");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeChampionshipWeek_seasonId_thursdayPublishDate_key" ON "ChallengeChampionshipWeek"("seasonId", "thursdayPublishDate");

-- CreateIndex
CREATE INDEX "ChallengeRun_championshipWeekId_type_status_idx" ON "ChallengeRun"("championshipWeekId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeRun_championshipWeekId_type_attempt_key" ON "ChallengeRun"("championshipWeekId", "type", "attempt");

-- CreateIndex
CREATE INDEX "ChallengeRanking_runId_regionCode_levelCode_position_idx" ON "ChallengeRanking"("runId", "regionCode", "levelCode", "position");

-- CreateIndex
CREATE INDEX "ChallengeRanking_playerUniqueIndex_runId_idx" ON "ChallengeRanking"("playerUniqueIndex", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeRanking_runId_playerUniqueIndex_key" ON "ChallengeRanking"("runId", "playerUniqueIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeRanking_runId_regionCode_levelCode_position_key" ON "ChallengeRanking"("runId", "regionCode", "levelCode", "position");

-- CreateIndex
CREATE INDEX "ChallengePlayerPoint_playerUniqueIndex_runId_week_idx" ON "ChallengePlayerPoint"("playerUniqueIndex", "runId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengePlayerPoint_runId_playerUniqueIndex_matchUniqueId_key" ON "ChallengePlayerPoint"("runId", "playerUniqueIndex", "matchUniqueId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeRegionSummary_runId_regionCode_key" ON "ChallengeRegionSummary"("runId", "regionCode");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengePressDelivery_runId_key" ON "ChallengePressDelivery"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengePublication_championshipWeekId_key" ON "ChallengePublication"("championshipWeekId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengePublication_runId_key" ON "ChallengePublication"("runId");

-- CreateIndex
CREATE INDEX "ChallengePublication_seasonId_publishedAt_idx" ON "ChallengePublication"("seasonId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengePublication_seasonId_championshipWeekId_key" ON "ChallengePublication"("seasonId", "championshipWeekId");

-- AddForeignKey
ALTER TABLE "ChallengeSecretReference" ADD CONSTRAINT "ChallengeSecretReference_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeSeason" ADD CONSTRAINT "ChallengeSeason_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeRule" ADD CONSTRAINT "ChallengeRule_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "ChallengeSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeRegion" ADD CONSTRAINT "ChallengeRegion_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "ChallengeSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeClub" ADD CONSTRAINT "ChallengeClub_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "ChallengeSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeClub" ADD CONSTRAINT "ChallengeClub_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "ChallengeRegion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeLevel" ADD CONSTRAINT "ChallengeLevel_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "ChallengeSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeDivision" ADD CONSTRAINT "ChallengeDivision_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "ChallengeSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeDivision" ADD CONSTRAINT "ChallengeDivision_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "ChallengeLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengePointOverride" ADD CONSTRAINT "ChallengePointOverride_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "ChallengeSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeExcludedPlayer" ADD CONSTRAINT "ChallengeExcludedPlayer_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "ChallengeSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengePressRecipient" ADD CONSTRAINT "ChallengePressRecipient_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "ChallengeSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeChampionshipWeek" ADD CONSTRAINT "ChallengeChampionshipWeek_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "ChallengeSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeRun" ADD CONSTRAINT "ChallengeRun_championshipWeekId_fkey" FOREIGN KEY ("championshipWeekId") REFERENCES "ChallengeChampionshipWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeRanking" ADD CONSTRAINT "ChallengeRanking_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ChallengeRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengePlayerPoint" ADD CONSTRAINT "ChallengePlayerPoint_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ChallengeRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeRegionSummary" ADD CONSTRAINT "ChallengeRegionSummary_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ChallengeRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengePressDelivery" ADD CONSTRAINT "ChallengePressDelivery_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ChallengeRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengePublication" ADD CONSTRAINT "ChallengePublication_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "ChallengeSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengePublication" ADD CONSTRAINT "ChallengePublication_championshipWeekId_fkey" FOREIGN KEY ("championshipWeekId") REFERENCES "ChallengeChampionshipWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengePublication" ADD CONSTRAINT "ChallengePublication_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ChallengeRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
