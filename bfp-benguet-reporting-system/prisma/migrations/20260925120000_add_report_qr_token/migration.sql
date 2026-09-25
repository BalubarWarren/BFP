-- AlterTable
ALTER TABLE "reports" ADD COLUMN "qrToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "reports_qrToken_key" ON "reports"("qrToken");
