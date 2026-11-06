-- CreateTable
CREATE TABLE "AdditionalMaintenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "maintenanceStatus" TEXT NOT NULL DEFAULT 'PLAN',
    "scheduledDate" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "completionDate" DATETIME,
    "completedBy" TEXT,
    "actualStartTime" DATETIME,
    "actualEndTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdditionalMaintenance_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
