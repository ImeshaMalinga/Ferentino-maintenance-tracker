import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseWorkbook } from '../src/services/excel/excelParser';

describe('maintenance workbook parser', () => {
  it('extracts the supplied November workbook', async () => {
    const file = path.resolve(__dirname, '../../sample-data/November-2026.xlsx');
    const parsed = await parseWorkbook(fs.readFileSync(file));
    expect(parsed.month).toBe(11);
    expect(parsed.year).toBe(2026);
    expect(parsed.machines).toHaveLength(43);
    expect(parsed.activities.filter((x) => x.status === 'PLAN').length).toBeGreaterThan(40);
    expect(parsed.activities.every((x) => x.maintenanceType.length > 0)).toBe(true);
  });
});
