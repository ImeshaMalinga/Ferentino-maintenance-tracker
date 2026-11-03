import { ImportStatus, MaintenanceStatus } from '@prisma/client';
import { prisma } from '../db';
import { ParseResult } from './excel/excelParser';

export async function importSchedule(parsed: ParseResult, fileName: string, replace: boolean) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.importBatch.findUnique({
      where: {
        month_year: {
          month: parsed.month,
          year: parsed.year,
        },
      },
    });
    if (existing && !replace) {
      throw Object.assign(
        new Error('A schedule for this month already exists.'),
        { statusCode: 409 },
      );
    }
    if (existing) {
      await tx.importBatch.delete({ where: { id: existing.id } });
    }
    const batch = await tx.importBatch.create({
      data: {
        fileName,
        month: parsed.month,
        year: parsed.year,
        totalMachines: parsed.machines.length,
        totalPlannedActivities: parsed.activities.filter(
          (x) => x.status === 'PLAN',
        ).length,
        totalActualActivities: parsed.activities.filter(
          (x) => x.status === 'ACTUAL',
        ).length,
        importedAt: new Date(),
        status: existing
          ? ImportStatus.REPLACED
          : ImportStatus.IMPORTED,
      },
    });
    const machineIds = new Map<string, string>();
    for (const machine of parsed.machines) {
      const match = await tx.machine.findFirst({
        where: {
          machineName: machine.machineName,
          ...(machine.machineCode
            ? { machineCode: machine.machineCode }
            : {}),
          ...(machine.serialNumber
            ? { serialNumber: machine.serialNumber }
            : {}),
        },
      });
      const saved =
        match ??
        (await tx.machine.create({
          data: {
            machineName: machine.machineName,
            machineCode: machine.machineCode,
            serialNumber: machine.serialNumber,
            plant: machine.plant,
          },
        }));
      machineIds.set(machine.machineKey, saved.id);
    }
    await tx.maintenanceRecord.createMany({
      data: parsed.activities.map((activity) => ({
        machineId: machineIds.get(activity.machineKey)!,
        maintenanceType: activity.maintenanceType,
        maintenanceStatus: activity.status as MaintenanceStatus,
        scheduledDate: new Date(activity.scheduledDate),
        sourceMonth: parsed.month,
        sourceYear: parsed.year,
        importBatchId: batch.id,
      })),
    });
    return batch;
  });
}
