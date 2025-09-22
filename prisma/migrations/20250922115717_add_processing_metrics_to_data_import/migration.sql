-- AlterTable
ALTER TABLE "DataImport" ADD COLUMN     "linesProcessed" INTEGER,
ADD COLUMN     "processingTimeMs" INTEGER;

-- CreateIndex
CREATE INDEX "idx_member_licence_category" ON "Member"("licence", "playerCategory");

-- CreateIndex
CREATE INDEX "idx_member_category_ranking" ON "Member"("playerCategory", "ranking");

-- CreateIndex
CREATE INDEX "idx_member_club_category" ON "Member"("club", "playerCategory");
