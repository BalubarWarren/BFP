-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_reports" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reportType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "municipalityId" INTEGER NOT NULL,
    "incidentId" INTEGER,
    "reportDate" DATETIME NOT NULL,
    "content" TEXT NOT NULL,
    "respondingUnits" TEXT,
    "respondingOfficer" TEXT,
    "reportingOfficerRank" TEXT,
    "stationCommanderName" TEXT,
    "remarks" TEXT,
    "passedToRole" TEXT,
    "passedToId" INTEGER,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewedById" INTEGER,
    "submittedById" INTEGER NOT NULL,
    "attachments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reports_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "municipalities" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reports_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reports_passedToId_fkey" FOREIGN KEY ("passedToId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reports_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reports_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_reports" ("attachments", "content", "createdAt", "id", "incidentId", "municipalityId", "passedToId", "passedToRole", "remarks", "reportDate", "reportType", "reportingOfficerRank", "respondingOfficer", "respondingUnits", "reviewedAt", "reviewedById", "stationCommanderName", "status", "submittedAt", "submittedById", "updatedAt") SELECT "attachments", "content", "createdAt", "id", "incidentId", "municipalityId", "passedToId", "passedToRole", "remarks", "reportDate", "reportType", "reportingOfficerRank", "respondingOfficer", "respondingUnits", "reviewedAt", "reviewedById", "stationCommanderName", "status", "submittedAt", "submittedById", "updatedAt" FROM "reports";
DROP TABLE "reports";
ALTER TABLE "new_reports" RENAME TO "reports";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
