import { describe, expect, it } from 'vitest';
import { DEFAULT_SHEET } from './defaultSheet';
import { evaluateFormula, ExcelError, type CellValue } from '../../../lib/excel/engine';
import { EXCEL_FUNCTIONS } from '../../../content/vocab';

/**
 * The sheets in content/excel/*.yaml have every task's reference solution evaluated by
 * `npm run validate`. This one is a TypeScript constant, so the content validator never sees it —
 * which is exactly how a widget ends up shipping an exercise whose stated answer is wrong.
 *
 * These tests give it the same guarantee.
 */
describe('ExcelGrid default sheet', () => {
  const data: CellValue[][] = [DEFAULT_SHEET.columns as CellValue[], ...(DEFAULT_SHEET.rows as CellValue[][])];
  const grid = {
    rows: data.length + 40,
    cols: DEFAULT_SHEET.columns.length + 12,
    get: (r: number, c: number): CellValue => data[r]?.[c] ?? null,
  };

  it('has tasks', () => {
    expect(DEFAULT_SHEET.tasks.length).toBeGreaterThan(0);
  });

  it('every row is within the declared columns', () => {
    for (const row of DEFAULT_SHEET.rows) expect(row.length).toBeLessThanOrEqual(DEFAULT_SHEET.columns.length);
  });

  it.each(DEFAULT_SHEET.tasks.map((t) => [t.cell, t.solution, t.expected, t.tolerance] as const))(
    'task %s: solution %s produces %s',
    (_cell, solution, expected, tolerance) => {
      const got = evaluateFormula(solution, grid);
      expect(got).not.toBeInstanceOf(ExcelError);
      if (typeof expected === 'number') {
        expect(typeof got).toBe('number');
        expect(Math.abs((got as number) - expected)).toBeLessThanOrEqual(tolerance || 0);
      } else {
        expect(String(got)).toBe(String(expected));
      }
    },
  );

  it('uses only functions the sandbox engine supports', () => {
    const supported = new Set<string>(EXCEL_FUNCTIONS);
    const formulas = [
      ...DEFAULT_SHEET.tasks.map((t) => t.solution),
      ...DEFAULT_SHEET.rows.flat().filter((c): c is string => typeof c === 'string' && c.startsWith('=')),
    ];
    for (const f of formulas) {
      for (const m of f.matchAll(/([A-Z][A-Z0-9.]*)\s*\(/g)) expect(supported).toContain(m[1]);
    }
  });
});
