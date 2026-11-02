-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineCode" TEXT,
    "serialNumber" TEXT,
    "machineName" TEXT NOT NULL,
    "plant" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalMachines" INTEGER NOT NULL DEFAULT 0,
    "totalPlannedActivities" INTEGER NOT NULL DEFAULT 0,
    "totalActualActivities" INTEGER NOT NULL DEFAULT 0,
    "importedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PREVIEWED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "maintenanceType" TEXT NOT NULL,
    "maintenanceStatus" TEXT NOT NULL,
    "scheduledDate" DATETIME NOT NULL,
    "sourceMonth" INTEGER NOT NULL,
    "sourceYear" INTEGER NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaintenanceRecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRecord_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Machine_machineName_idx" ON "Machine"("machineName");

-- CreateIndex
CREATE INDEX "Machine_machineCode_idx" ON "Machine"("machineCode");

-- CreateIndex
CREATE INDEX "Machine_serialNumber_idx" ON "Machine"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_month_year_key" ON "ImportBatch"("month", "year");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_scheduledDate_idx" ON "MaintenanceRecord"("scheduledDate");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_machineId_scheduledDate_idx" ON "MaintenanceRecord"("machineId", "scheduledDate");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_importBatchId_idx" ON "MaintenanceRecord"("importBatchId");
