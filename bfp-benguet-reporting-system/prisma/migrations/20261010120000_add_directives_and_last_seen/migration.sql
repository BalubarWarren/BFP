-- AlterTable
ALTER TABLE "users" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "directives" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "municipalityId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "reportType" TEXT,
    "message" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "response" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "directives_recipientId_createdAt_idx" ON "directives"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "directives_senderId_createdAt_idx" ON "directives"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "directives_municipalityId_idx" ON "directives"("municipalityId");

-- AddForeignKey
ALTER TABLE "directives" ADD CONSTRAINT "directives_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "municipalities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directives" ADD CONSTRAINT "directives_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directives" ADD CONSTRAINT "directives_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
