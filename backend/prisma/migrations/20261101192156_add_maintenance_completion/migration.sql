-- AlterTable
ALTER TABLE "MaintenanceRecord" ADD COLUMN "actualEndTime" DATETIME;
ALTER TABLE "MaintenanceRecord" ADD COLUMN "actualStartTime" DATETIME;
ALTER TABLE "MaintenanceRecord" ADD COLUMN "completedBy" TEXT;
ALTER TABLE "MaintenanceRecord" ADD COLUMN "completionDate" DATETIME;
