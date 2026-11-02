import ExcelJS from 'exceljs';

export type ParsedActivity = {
  machineKey: string;
  machineCode: string | null;
  serialNumber: string | null;
  machineName: string;
  plant: string | null;
  maintenanceType: string;
  status: 'PLAN' | 'ACTUAL';
  scheduledDate: string;
};

export type ParseWarning = { message: string; row?: number };
export type ParseResult = {
  month: number;
  year: number;
  plant: string | null;
  machines: Array<{ machineKey: string; machineCode: string | null; serialNumber: string | null; machineName: string; plant: string | null }>;
  activities: ParsedActivity[];
  warnings: ParseWarning[];
};

const clean = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
const codes = (value: unknown) => clean(value).split(/[\s,;/]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);

function cellText(value: ExcelJS.CellValue): string {
  if (value && typeof value === 'object' && 'richText' in value) return value.richText.map((x) => x.text).join('');
  if (value && typeof value === 'object' && 'text' in value) return value.text;
  return clean(value);
}

function parseMonthYear(value: string): { month: number; year: number } | null {
  const match = value.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*[,/-]\s*(20\d{2})/i);
  if (!match) return null;
  const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].findIndex((m) => match[0].toLowerCase().startsWith(m)) + 1;
  return month > 0 ? { month, year: Number(match[1]) } : null;
}

type ExcelBuffer = Parameters<ExcelJS.Workbook['xlsx']['load']>[0];

export async function parseWorkbook(buffer: Uint8Array): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelBuffer);
  const warnings: ParseWarning[] = [];
  const sheet = workbook.worksheets.find((candidate) => {
    let found = false;
    candidate.eachRow((row) => row.eachCell((cell) => { if (cellText(cell.value).toLowerCase() === 'status') found = true; }));
    return found;
  });
  if (!sheet) throw new Error('No worksheet with a maintenance Status header was found.');

  let headerRow = 0;
  let statusColumn = 0;
  let dayColumns: Array<{ column: number; day: number }> = [];
  let plant: string | null = null;
  let monthYear: { month: number; year: number } | null = null;
  sheet.eachRow((row, rowNumber) => {
    const values = row.values as ExcelJS.CellValue[];
    values.forEach((value, index) => {
      const text = cellText(value);
      if (text.toLowerCase() === 'status') { headerRow = rowNumber; statusColumn = index; }
      if (/month\/year/i.test(text)) {
        const next = cellText(values[index + 1]);
        monthYear = parseMonthYear(next);
      }
      if (/section/i.test(text)) plant = cellText(values[index + 1]) || null;
    });
    if (headerRow === rowNumber) {
      values.forEach((value, index) => { const day = Number(cellText(value)); if (day >= 1 && day <= 31) dayColumns.push({ column: index, day }); });
    }
  });
  if (!headerRow || !statusColumn || dayColumns.length === 0) throw new Error('Could not identify the status and calendar-date columns.');
  const schedule = monthYear as { month: number; year: number } | null;
  if (!schedule) throw new Error('The workbook must contain a month/year such as "Nov,2026".');

  const machines = new Map<string, ParseResult['machines'][number]>();
  const activities: ParsedActivity[] = [];
  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const status = cellText(row.getCell(statusColumn).value).toUpperCase();
    if (status !== 'PLAN' && status !== 'ACTUAL') continue;
    const info = {
      machineCode: clean(row.getCell(2).value) || null,
      serialNumber: clean(row.getCell(1).value) || null,
      machineName: clean(row.getCell(3).value),
      plant,
    };
    if (!info.machineName) { warnings.push({ message: 'A maintenance row has no machine name.', row: rowNumber }); continue; }
    const machineKey = `${info.machineCode ?? ''}|${info.serialNumber ?? ''}|${info.machineName.toLowerCase()}`;
    machines.set(machineKey, { machineKey, ...info });
    for (const { column, day } of dayColumns) {
      for (const maintenanceType of codes(row.getCell(column).value)) {
        if (!schedule) continue;
        activities.push({ machineKey, ...info, maintenanceType, status: status as 'PLAN' | 'ACTUAL', scheduledDate: new Date(Date.UTC(schedule.year, schedule.month - 1, day)).toISOString() });
      }
    }
  }

  return { ...schedule, plant, machines: [...machines.values()], activities, warnings };
}
