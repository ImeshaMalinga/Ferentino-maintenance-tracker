import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { z } from 'zod';
import { env } from './config/env';
import { prisma } from './db';
import { parseWorkbook } from './services/excel/excelParser';
import { importSchedule } from './services/importService';

const app = express();
const ALLOWED_MAINTENANCE_TYPES = ['MM', '3MM', '6MM', 'AM', 'WM'] as const;
const maintenanceTypeFilter = { maintenanceType: { in: [...ALLOWED_MAINTENANCE_TYPES] } };
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, /\.(xlsx|xls)$/i.test(file.originalname)) });
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/dashboard/summary', async (_req, res, next) => { try {
  const now = new Date(); const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
  const [machines, scheduled, done, toDo, today, upcoming, overdue] = await Promise.all([
    prisma.machine.count({ where: { isActive: true, maintenance: { some: maintenanceTypeFilter } } }), prisma.maintenanceRecord.count({ where: maintenanceTypeFilter }), prisma.maintenanceRecord.count({ where: { ...maintenanceTypeFilter, maintenanceStatus: 'ACTUAL' } }), prisma.maintenanceRecord.count({ where: { ...maintenanceTypeFilter, maintenanceStatus: 'PLAN' } }), prisma.maintenanceRecord.count({ where: { ...maintenanceTypeFilter, maintenanceStatus: 'PLAN', scheduledDate: { gte: start, lt: end } } }), prisma.maintenanceRecord.count({ where: { ...maintenanceTypeFilter, maintenanceStatus: 'PLAN', scheduledDate: { gt: end } } }), prisma.maintenanceRecord.count({ where: { ...maintenanceTypeFilter, maintenanceStatus: 'PLAN', scheduledDate: { lt: start } } })
  ]); res.json({ machines, scheduled, done, toDo, completed: done, today, upcoming, overdue });
} catch (e) { next(e); }
});

app.get('/api/machines', async (req, res, next) => { try {
  const query = String(req.query.search ?? ''); const machines = await prisma.machine.findMany({ where: { ...(query ? { OR: [{ machineName: { contains: query } }, { machineCode: { contains: query } }, { serialNumber: { contains: query } }] } : {}), maintenance: { some: maintenanceTypeFilter } }, include: { maintenance: { where: { ...maintenanceTypeFilter, maintenanceStatus: 'PLAN' }, orderBy: { scheduledDate: 'asc' } } }, orderBy: { machineName: 'asc' } });
  res.json(machines.map(({ maintenance, ...machine }) => ({ ...machine, scheduledCount: maintenance.length, nextDate: maintenance[0]?.scheduledDate ?? null })));
} catch (e) { next(e); }
});

app.get('/api/machines/:id/maintenance', async (req, res, next) => {
  try {
    res.json(await prisma.maintenanceRecord.findMany({ where: { machineId: req.params.id, ...maintenanceTypeFilter }, orderBy: { scheduledDate: 'asc' } }));
  } catch (e) { next(e); }
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
    const datePart = input.completionDate === undefined ? current.completionDate : input.completionDate ? `${input.completionDate}T00:00:00.000Z` : null;
    const timeValue = (value: string | null | undefined, existing: Date | null) => value === undefined ? existing : value ? new Date(`1970-01-01T${value}:00.000Z`) : null;
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
  try { const month = Number(req.query.month); const year = Number(req.query.year); res.json(await prisma.maintenanceRecord.findMany({ where: { ...maintenanceTypeFilter, ...(month && year ? { sourceMonth: month, sourceYear: year } : {}) }, include: { machine: true }, orderBy: { scheduledDate: 'asc' } })); } catch (e) { next(e); }
});

app.get('/api/calendar', async (req, res, next) => {
  try { const input = z.object({ month: z.coerce.number().min(1).max(12), year: z.coerce.number().min(2000).max(2100) }).parse(req.query); res.json(await prisma.maintenanceRecord.findMany({ where: { ...maintenanceTypeFilter, sourceMonth: input.month, sourceYear: input.year }, include: { machine: true }, orderBy: { scheduledDate: 'asc' } })); } catch (e) { next(e); }
});

app.post('/api/import/preview', upload.single('file'), async (req, res, next) => { try { if (!req.file) return res.status(400).json({ error: 'An .xlsx or .xls file is required.' }); res.json(await parseWorkbook(req.file.buffer)); } catch (e) { next(e); } });
app.post('/api/import/confirm', async (req, res, next) => { try { const parsed = req.body.parsed as Parameters<typeof importSchedule>[0]; const fileName = z.string().min(1).parse(req.body.fileName); const replace = z.boolean().default(false).parse(req.body.replace); res.status(201).json(await importSchedule(parsed, fileName, replace)); } catch (e) { next(e); } });
app.get('/api/import/history', async (_req, res, next) => { try { res.json(await prisma.importBatch.findMany({ orderBy: { createdAt: 'desc' } })); } catch (e) { next(e); } });
app.use((error: Error & { statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error(error); res.status(error.statusCode ?? 500).json({ error: error.message || 'Unexpected server error.' }); });
app.listen(env.port, () => console.log(`Maintenance Tracker API listening on ${env.port}`));
