-- Captain data belongs to one side of a match. A match can therefore have one
-- independent poll and lineup per participating club.
DROP INDEX IF EXISTS "AvailabilityPoll_matchUniqueId_key";
DROP INDEX IF EXISTS "Lineup_matchUniqueId_key";
DROP INDEX IF EXISTS "Convocation_matchUniqueId_key";

CREATE UNIQUE INDEX "AvailabilityPoll_matchUniqueId_clubIndex_key"
ON "AvailabilityPoll"("matchUniqueId", "clubIndex");

CREATE UNIQUE INDEX "Lineup_matchUniqueId_clubIndex_key"
ON "Lineup"("matchUniqueId", "clubIndex");

CREATE INDEX "Convocation_matchUniqueId_idx"
ON "Convocation"("matchUniqueId");

ALTER TABLE "Convocation"
ADD COLUMN "publicTokenExpiresAt" TIMESTAMP(3);
