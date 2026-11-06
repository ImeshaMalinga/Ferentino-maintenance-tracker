import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { env } from './config/env';
import { prisma } from './db';
import { parseWorkbook } from './services/excel/excelParser';
import { importSchedule } from './services/importService';

const app = express();
const ALLOWED_MAINTENANCE_TYPES = ['MM', '3MM', '6MM', 'AM', 'WM', 'ME','3ME','6ME','AE'] as const;
const MECHANICAL_MAINTENANCE_TYPES = ['MM', '3MM', '6MM', 'AM', 'WM'] as const;
const ELECTRICAL_MAINTENANCE_TYPES = ['ME', '3ME', '6ME', 'AE'] as const;
const maintenanceTypeFilter = {
  maintenanceType: { in: [...ALLOWED_MAINTENANCE_TYPES] },
};
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, /\.(xlsx|xls)$/i.test(file.originalname));
  },
});
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/dashboard/summary', async (req, res, next) => {
  try {
    const now = new Date();
    const requestedMonth = Number(req.query.month);
    const requestedYear = Number(req.query.year);
    const selectedMonth =
      Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
        ? requestedMonth
        : now.getUTCMonth() + 1;
    const selectedYear =
      Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
        ? requestedYear
        : now.getUTCFullYear();
    const monthFilter = {
      sourceMonth: selectedMonth,
      sourceYear: selectedYear,
    };
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const selectedMonthStart = new Date(
      Date.UTC(selectedYear, selectedMonth - 1, 1),
    );
    const selectedMonthEnd = new Date(
      Date.UTC(selectedYear, selectedMonth, 1),
    );
    const isCurrentMonth =
      selectedYear === now.getUTCFullYear() &&
      selectedMonth === now.getUTCMonth() + 1;
    const isPastMonth = selectedMonthEnd <= new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const maintenanceWhere = { ...maintenanceTypeFilter, ...monthFilter };

    const [
      machines,
      scheduled,
      done,
      toDo,
      today,
      upcoming,
      overdue,
      notDone,
      typeCounts,
      statusRecords,
    ] = await Promise.all([
      prisma.machine.count({
        where: {
          isActive: true,
          maintenance: { some: maintenanceWhere },
        },
      }),
      prisma.maintenanceRecord.count({ where: maintenanceWhere }),
      prisma.maintenanceRecord.count({
        where: { ...maintenanceWhere, maintenanceStatus: 'ACTUAL' },
      }),
      prisma.maintenanceRecord.count({
        where: { ...maintenanceWhere, maintenanceStatus: 'PLAN' },
      }),
      prisma.maintenanceRecord.count({
        where: {
          ...maintenanceWhere,
          maintenanceStatus: 'PLAN',
          scheduledDate: isCurrentMonth
            ? { gte: start, lt: end }
            : { gte: selectedMonthStart, lt: selectedMonthStart },
        },
      }),
      prisma.maintenanceRecord.count({
        where: {
          ...maintenanceWhere,
          maintenanceStatus: 'PLAN',
          scheduledDate: isCurrentMonth
            ? { gt: end }
            : isPastMonth
              ? { gte: selectedMonthStart, lt: selectedMonthStart }
              : { gte: selectedMonthStart, lt: selectedMonthEnd },
        },
      }),
      prisma.maintenanceRecord.count({
        where: {
          ...maintenanceWhere,
          maintenanceStatus: 'PLAN',
          scheduledDate: isCurrentMonth
            ? { gte: selectedMonthStart, lt: start }
            : { gte: selectedMonthStart, lt: selectedMonthStart },
        },
      }),
      prisma.maintenanceRecord.count({
        where: {
          ...maintenanceWhere,
          maintenanceStatus: 'PLAN',
          scheduledDate: isPastMonth
            ? { gte: selectedMonthStart, lt: selectedMonthEnd }
            : { gte: selectedMonthStart, lt: selectedMonthStart },
        },
      }),
      prisma.maintenanceRecord.groupBy({
        by: ['maintenanceType'],
        where: maintenanceWhere,
        _count: { _all: true },
      }),
      prisma.maintenanceRecord.findMany({
        where: maintenanceWhere,
        select: {
          maintenanceType: true,
          maintenanceStatus: true,
          scheduledDate: true,
        },
      }),
    ]);

    const maintenanceStatusCounts = {
      mechanical: { Done: 0, Overdue: 0, 'Not done': 0, 'Scheduled maintenance': 0 },
      electrical: { Done: 0, Overdue: 0, 'Not done': 0, 'Scheduled maintenance': 0 },
      all: { Done: 0, Overdue: 0, 'Not done': 0, 'Scheduled maintenance': 0 },
    };
    for (const record of statusRecords) {
      const discipline = MECHANICAL_MAINTENANCE_TYPES.includes(
        record.maintenanceType as (typeof MECHANICAL_MAINTENANCE_TYPES)[number],
      )
        ? 'mechanical'
        : 'electrical';
      const status =
        record.maintenanceStatus === 'ACTUAL'
          ? 'Done'
          : isPastMonth
            ? 'Not done'
            : isCurrentMonth && record.scheduledDate < start
            ? 'Overdue'
            : 'Scheduled maintenance';
      maintenanceStatusCounts[discipline][status] += 1;
      maintenanceStatusCounts.all[status] += 1;
    }

    res.json({
      machines,
      scheduled,
      done,
      toDo,
      completed: done,
      today,
      upcoming,
      overdue,
      notDone,
      maintenanceTypeCounts: Object.fromEntries(
        ALLOWED_MAINTENANCE_TYPES.map((type) => [
          type,
          typeCounts.find((item) => item.maintenanceType === type)?._count._all ?? 0,
        ]),
      ),
      maintenanceStatusCounts,
    });
  } catch (e) {
    next(e);
  }
});

app.get('/api/reports/monthly', async (req, res, next) => {
  try {
    const month = z.coerce.number().int().min(1).max(12).parse(req.query.month);
    const year = z.coerce.number().int().min(2000).max(2100).parse(req.query.year);
    const machines = await prisma.machine.findMany({
      where: {
        isActive: true,
        maintenance: {
          some: {
            ...maintenanceTypeFilter,
            sourceMonth: month,
            sourceYear: year,
          },
        },
      },
      include: {
        maintenance: {
          where: {
            ...maintenanceTypeFilter,
            sourceMonth: month,
            sourceYear: year,
          },
          orderBy: { scheduledDate: 'asc' },
        },
        additionalMaintenance: {
          orderBy: { discipline: 'asc' },
        },
      },
      orderBy: { machineName: 'asc' },
    });

    res.json({ month, year, machines });
  } catch (e) {
    next(e);
  }
});

app.get('/api/machines', async (req, res, next) => {
  try {
    const query = String(req.query.search ?? '');
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const monthFilter =
      Number.isInteger(month) &&
      month >= 1 &&
      month <= 12 &&
      Number.isInteger(year)
        ? { sourceMonth: month, sourceYear: year }
        : {};
    const machines = await prisma.machine.findMany({
      where: {
        ...(query
          ? {
              OR: [
                { machineName: { contains: query } },
                { machineCode: { contains: query } },
                { serialNumber: { contains: query } },
              ],
            }
          : {}),
        maintenance: {
          some: { ...maintenanceTypeFilter, ...monthFilter },
        },
      },
      include: {
        maintenance: {
          where: { ...maintenanceTypeFilter, ...monthFilter },
          orderBy: { scheduledDate: 'asc' },
        },
      },
      orderBy: { machineName: 'asc' },
    });

    res.json(
      machines.map(({ maintenance, ...machine }) => {
        const planned = maintenance.filter((item) => item.maintenanceStatus === 'PLAN');
        const maintenanceTypeCounts = Object.fromEntries(
          ALLOWED_MAINTENANCE_TYPES.map((type) => [
            type,
            maintenance.filter((item) => item.maintenanceType === type).length,
          ]),
        );
        return {
          ...machine,
          scheduledCount: planned.length,
          nextDate: planned[0]?.scheduledDate ?? null,
          maintenanceTypeCounts,
          mechanicalCount: MECHANICAL_MAINTENANCE_TYPES.reduce(
            (total, type) => total + maintenanceTypeCounts[type],
            0,
          ),
          electricalCount: ELECTRICAL_MAINTENANCE_TYPES.reduce(
            (total, type) => total + maintenanceTypeCounts[type],
            0,
          ),
        };
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.get('/api/machines/:id', async (req, res, next) => {
  try {
    res.json(
      await prisma.maintenanceRecord.findMany({
        where: {
          machineId: req.params.id,
          ...maintenanceTypeFilter,
        },
        orderBy: { scheduledDate: 'asc' },
      }),
    );
    console.log('hi');
  } catch (e) {
    next(e);
  }
});

const additionalMaintenanceSchema = z.object({
  discipline: z.enum(['MECHANICAL', 'ELECTRICAL']),
  description: z.string().trim().min(1).max(500),
  isCompleted: z.boolean().optional(),
  completionDate: z.string().date().nullable().optional(),
  completedBy: z.string().trim().max(120).nullable().optional(),
  actualStartTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  actualEndTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

const additionalMaintenanceData = (
  input: z.infer<typeof additionalMaintenanceSchema>,
) => {
  const start = input.actualStartTime
    ? new Date(`1970-01-01T${input.actualStartTime}:00.000Z`)
    : null;
  const end = input.actualEndTime
    ? new Date(`1970-01-01T${input.actualEndTime}:00.000Z`)
    : null;
  if (start && end && start >= end) {
    throw new Error('Start time must be earlier than end time.');
  }
  const hasCompletion =
    input.isCompleted ??
    Boolean(input.completionDate || input.completedBy || start || end);
  return {
    discipline: input.discipline,
    description: input.description,
    isCompleted: hasCompletion,
    completionDate: input.completionDate
      ? new Date(`${input.completionDate}T00:00:00.000Z`)
      : null,
    completedBy: input.completedBy || null,
    actualStartTime: start,
    actualEndTime: end,
  };
};

app.get('/api/machines/:id/additional-maintenance', async (req, res, next) => {
  try {
    const machine = await prisma.machine.findUnique({ where: { id: req.params.id } });
    if (!machine) return res.status(404).json({ error: 'Machine not found.' });
    res.json(
      await prisma.additionalMaintenance.findMany({
        where: { machineId: req.params.id },
        orderBy: [{ discipline: 'asc' }, { createdAt: 'asc' }],
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.post('/api/machines/:id/additional-maintenance', async (req, res, next) => {
  try {
    const input = additionalMaintenanceSchema.parse(req.body);

    const machine = await prisma.machine.findUnique({ where: { id: req.params.id } });
    if (!machine) return res.status(404).json({ error: 'Machine not found.' });

    let maintenance;
    try {
      maintenance = await prisma.additionalMaintenance.create({
        data: {
          machineId: req.params.id,
          ...additionalMaintenanceData(input),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return res.status(409).json({
          error: `A ${input.discipline.toLowerCase()} additional maintenance item already exists for this machine.`,
        });
      }
      throw error;
    }

    res.json(maintenance);
  } catch (e) {
    next(e);
  }
});

const additionalMaintenanceUpdateSchema = z.object({
  description: z.string().trim().min(1).max(500).optional(),
  isCompleted: z.boolean().optional(),
});

app.patch('/api/additional-maintenance/:id', async (req, res, next) => {
  try {
    const input = additionalMaintenanceUpdateSchema.parse(req.body);
    const current = await prisma.additionalMaintenance.findUnique({
      where: { id: req.params.id },
    });
    if (!current) {
      return res.status(404).json({ error: 'Additional maintenance item not found.' });
    }

    res.json(
      await prisma.additionalMaintenance.update({
        where: { id: req.params.id },
        data: {
          ...(input.description === undefined
            ? {}
            : { description: input.description }),
          ...(input.isCompleted === undefined
            ? {}
            : { isCompleted: input.isCompleted }),
        },
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.delete('/api/additional-maintenance/:id', async (req, res, next) => {
  try {
    const current = await prisma.additionalMaintenance.findUnique({
      where: { id: req.params.id },
    });
    if (!current) {
      return res.status(404).json({ error: 'Additional maintenance item not found.' });
    }

    await prisma.additionalMaintenance.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

const maintenanceUpdateSchema = z.object({
  completionDate: z.string().date().nullable().optional(),
  completedBy: z.string().trim().max(120).nullable().optional(),
  actualStartTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  actualEndTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  maintenanceStatus: z.enum(['PLAN', 'ACTUAL']).optional(),
});

app.patch('/api/maintenance/:id', async (req, res, next) => {
  try {
    const input = maintenanceUpdateSchema.parse(req.body);
    const current = await prisma.maintenanceRecord.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'Maintenance record not found.' });
    const datePart =
      input.completionDate === undefined
        ? current.completionDate
        : input.completionDate
          ? `${input.completionDate}T00:00:00.000Z`
          : null;
    const timeValue = (
      value: string | null | undefined,
      existing: Date | null,
    ) =>
      value === undefined
        ? existing
        : value
          ? new Date(`1970-01-01T${value}:00.000Z`)
          : null;
    const start = timeValue(input.actualStartTime, current.actualStartTime);
    const end = timeValue(input.actualEndTime, current.actualEndTime);
    if (start && end && start >= end) return res.status(400).json({ error: 'Start time must be earlier than end time.' });
    const hasCompletion = datePart || input.completedBy || start || end;
    res.json(await prisma.maintenanceRecord.update({
      where: { id: req.params.id },
      data: {
        completionDate: datePart ? new Date(datePart) : null,
        completedBy: input.completedBy === undefined ? current.completedBy : input.completedBy || null,
        actualStartTime: start,
        actualEndTime: end,
        maintenanceStatus: input.maintenanceStatus ?? (hasCompletion ? 'ACTUAL' : 'PLAN'),
      },
    }));
  } catch (e) { next(e); }
});

app.get('/api/maintenance', async (req, res, next) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    res.json(
      await prisma.maintenanceRecord.findMany({
        where: {
          ...maintenanceTypeFilter,
          ...(month && year
            ? { sourceMonth: month, sourceYear: year }
            : {}),
        },
        include: { machine: true },
        orderBy: { scheduledDate: 'asc' },
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.get('/api/calendar', async (req, res, next) => {
  try {
    const input = z
      .object({
        month: z.coerce.number().min(1).max(12),
        year: z.coerce.number().min(2000).max(2100),
      })
      .parse(req.query);
    res.json(
      await prisma.maintenanceRecord.findMany({
        where: {
          ...maintenanceTypeFilter,
          sourceMonth: input.month,
          sourceYear: input.year,
        },
        include: { machine: true },
        orderBy: { scheduledDate: 'asc' },
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.post(
  '/api/import/preview',
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ error: 'An .xlsx or .xls file is required.' });
      }

      res.json(await parseWorkbook(req.file.buffer));
    } catch (e) {
      next(e);
    }
  },
);

app.post('/api/import/confirm', async (req, res, next) => {
  try {
    const parsed = req.body.parsed as Parameters<typeof importSchedule>[0];
    const fileName = z.string().min(1).parse(req.body.fileName);
    const replace = z.boolean().default(false).parse(req.body.replace);

    res
      .status(201)
      .json(await importSchedule(parsed, fileName, replace));
  } catch (e) {
    next(e);
  }
});

app.get('/api/import/history', async (_req, res, next) => {
  try {
    res.json(
      await prisma.importBatch.findMany({
        orderBy: { createdAt: 'desc' },
      }),
    );
  } catch (e) {
    next(e);
  }
});

app.use(
  (
    error: Error & { statusCode?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error);
    res
      .status(error.statusCode ?? 500)
      .json({ error: error.message || 'Unexpected server error.' });
  },
);

app.listen(env.port, () =>
  console.log(`Maintenance Tracker API listening on ${env.port}`),
);
