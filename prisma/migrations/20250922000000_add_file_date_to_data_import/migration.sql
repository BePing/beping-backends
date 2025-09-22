-- AlterTable
ALTER TABLE "DataImport" ADD COLUMN     "fileDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "DataImport_type_playerCategory_fileDate_idx" ON "DataImport"("type", "playerCategory", "fileDate");