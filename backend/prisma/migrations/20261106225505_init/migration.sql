-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('PLAN', 'ACTUAL');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PREVIEWED', 'IMPORTED', 'FAILED', 'REPLACED');

-- CreateEnum
CREATE TYPE "MaintenanceDiscipline" AS ENUM ('MECHANICAL', 'ELECTRICAL');

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "machineCode" TEXT,
    "serialNumber" TEXT,
    "machineName" TEXT NOT NULL,
    "plant" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdditionalMaintenance" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "discipline" "MaintenanceDiscipline" NOT NULL,
    "scheduledDate" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completionDate" TIMESTAMP(3),
    "completedBy" TEXT,
    "actualStartTime" TIMESTAMP(3),
    "actualEndTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdditionalMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalMachines" INTEGER NOT NULL DEFAULT 0,
    "totalPlannedActivities" INTEGER NOT NULL DEFAULT 0,
    "totalActualActivities" INTEGER NOT NULL DEFAULT 0,
    "importedAt" TIMESTAMP(3),
    "status" "ImportStatus" NOT NULL DEFAULT 'PREVIEWED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "maintenanceType" TEXT NOT NULL,
    "maintenanceStatus" "MaintenanceStatus" NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completionDate" TIMESTAMP(3),
    "completedBy" TEXT,
    "actualStartTime" TIMESTAMP(3),
    "actualEndTime" TIMESTAMP(3),
    "sourceMonth" INTEGER NOT NULL,
    "sourceYear" INTEGER NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Machine_machineName_idx" ON "Machine"("machineName");

-- CreateIndex
CREATE INDEX "Machine_machineCode_idx" ON "Machine"("machineCode");

-- CreateIndex
CREATE INDEX "Machine_serialNumber_idx" ON "Machine"("serialNumber");

-- CreateIndex
CREATE INDEX "AdditionalMaintenance_machineId_discipline_idx" ON "AdditionalMaintenance"("machineId", "discipline");

-- CreateIndex
CREATE UNIQUE INDEX "AdditionalMaintenance_machineId_discipline_key" ON "AdditionalMaintenance"("machineId", "discipline");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_month_year_key" ON "ImportBatch"("month", "year");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_scheduledDate_idx" ON "MaintenanceRecord"("scheduledDate");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_machineId_scheduledDate_idx" ON "MaintenanceRecord"("machineId", "scheduledDate");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_importBatchId_idx" ON "MaintenanceRecord"("importBatchId");

-- AddForeignKey
ALTER TABLE "AdditionalMaintenance" ADD CONSTRAINT "AdditionalMaintenance_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
