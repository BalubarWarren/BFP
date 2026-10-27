-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dutyOverride" TEXT,
ADD COLUMN     "dutyOverrideNote" TEXT,
ADD COLUMN     "dutyOverrideSetAt" TIMESTAMP(3),
ADD COLUMN     "dutyOverrideUntil" TEXT;

-- CreateTable
CREATE TABLE "duty_schedules" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "pattern" TEXT NOT NULL,
    "weekdays" TEXT,
    "rotationStart" TEXT,
    "rotationCycle" INTEGER,
    "rotationOnDays" INTEGER,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duty_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "duty_schedules_userId_key" ON "duty_schedules"("userId");

-- AddForeignKey
ALTER TABLE "duty_schedules" ADD CONSTRAINT "duty_schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
