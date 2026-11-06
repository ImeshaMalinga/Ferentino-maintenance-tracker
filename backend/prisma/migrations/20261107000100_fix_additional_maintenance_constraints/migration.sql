PRAGMA foreign_keys=OFF;

CREATE TABLE "new_AdditionalMaintenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "scheduledDate" DATETIME,
    "description" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completionDate" DATETIME,
    "completedBy" TEXT,
    "actualStartTime" DATETIME,
    "actualEndTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdditionalMaintenance_machineId_fkey"
      FOREIGN KEY ("machineId") REFERENCES "Machine" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_AdditionalMaintenance" (
    "id",
    "machineId",
    "discipline",
    "scheduledDate",
    "description",
    "isCompleted",
    "completionDate",
    "completedBy",
    "actualStartTime",
    "actualEndTime",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "machineId",
    "discipline",
    "scheduledDate",
    "description",
    "isCompleted",
    "completionDate",
    "completedBy",
    "actualStartTime",
    "actualEndTime",
    "createdAt",
    "updatedAt"
FROM "AdditionalMaintenance";

DROP TABLE "AdditionalMaintenance";
ALTER TABLE "new_AdditionalMaintenance" RENAME TO "AdditionalMaintenance";

CREATE INDEX "AdditionalMaintenance_machineId_discipline_idx"
  ON "AdditionalMaintenance"("machineId", "discipline");
CREATE UNIQUE INDEX "AdditionalMaintenance_machineId_discipline_key"
  ON "AdditionalMaintenance"("machineId", "discipline");

PRAGMA foreign_keys=ON;
