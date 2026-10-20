-- CreateTable
CREATE TABLE "trash_items" (
    "id" SERIAL NOT NULL,
    "itemType" TEXT NOT NULL,
    "originalId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "ownerId" INTEGER,
    "municipalityId" INTEGER,
    "deletedById" INTEGER NOT NULL,
    "deletedByName" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trash_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trash_items_deletedById_deletedAt_idx" ON "trash_items"("deletedById", "deletedAt");

-- CreateIndex
CREATE INDEX "trash_items_deletedAt_idx" ON "trash_items"("deletedAt");

-- CreateIndex
CREATE INDEX "trash_items_expiresAt_idx" ON "trash_items"("expiresAt");
