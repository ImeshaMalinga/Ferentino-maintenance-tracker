ALTER TABLE "AdditionalMaintenance"
ADD COLUMN "isCompleted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "AdditionalMaintenance_machineId_discipline_idx"
ON "AdditionalMaintenance"("machineId", "discipline");
