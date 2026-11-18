-- CreateTable
CREATE TABLE "report_requests" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reportId" INTEGER NOT NULL,
    "municipalityId" INTEGER NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "targetUserId" INTEGER,
    "reason" TEXT,
    "documentUrl" TEXT,
    "documentName" TEXT,
    "decidedById" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_requests_reportId_idx" ON "report_requests"("reportId");
CREATE INDEX "report_requests_municipalityId_status_idx" ON "report_requests"("municipalityId", "status");
CREATE INDEX "report_requests_targetUserId_status_idx" ON "report_requests"("targetUserId", "status");

-- AddForeignKey
ALTER TABLE "report_requests" ADD CONSTRAINT "report_requests_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_requests" ADD CONSTRAINT "report_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_requests" ADD CONSTRAINT "report_requests_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_requests" ADD CONSTRAINT "report_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
