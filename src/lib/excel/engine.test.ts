import { describe, expect, it } from 'vitest';
import { evaluateFormula, ExcelError, dateToSerial, type CellValue } from './engine';

// A1:D6 sheet — a small AE log
const data: CellValue[][] = [
  ['SUBJID', 'PT', 'GRADE', 'ONSET'],
  ['S-01', 'Nausea', 2, '2023-03-06'],
  ['S-01', 'Rash', 3, '2023-03-20'],
  ['S-02', 'Nausea', 1, '2023-04-02'],
  ['S-02', 'Fatigue', 3, '2023-04-15'],
  ['S-03', 'Nausea', 2, '2023-05-01'],
];
const grid = {
  rows: 10,
  cols: 8,
  get: (r: number, c: number): CellValue => data[r]?.[c] ?? null,
};
const ev = (f: string) => evaluateFormula(f, grid);

describe('Excel formula engine', () => {
  it('evaluates arithmetic and operator precedence', () => {
    expect(ev('=2+3*4')).toBe(14);
    expect(ev('=(2+3)*4')).toBe(20);
    expect(ev('=2^3^2')).toBe(512);
    expect(ev('=-3+1')).toBe(-2);
    expect(ev('=10/4')).toBe(2.5);
    expect((ev('=1/0') as ExcelError).code).toBe('#DIV/0!');
  });
  it('handles text, concatenation and comparisons', () => {
    expect(ev('="a"&"b"')).toBe('ab');
    expect(ev('=UPPER("alt")')).toBe('ALT');
    expect(ev('=TRIM("  a   b ")')).toBe('a b');
    expect(ev('=LEFT("1012-0007",4)')).toBe('1012');
    expect(ev('=3>2')).toBe(true);
    expect(ev('=IF(3>2,"yes","no")')).toBe('yes');
    expect(ev('=IFS(1>2,"a",2>1,"b")')).toBe('b');
  });
  it('aggregates ranges', () => {
    expect(ev('=SUM(C2:C6)')).toBe(11);
    expect(ev('=AVERAGE(C2:C6)')).toBeCloseTo(2.2, 10);
    expect(ev('=COUNT(C2:C6)')).toBe(5);
    expect(ev('=MAX(C2:C6)')).toBe(3);
    expect(ev('=MEDIAN(C2:C6)')).toBe(2);
  });
  it('applies criteria like Excel', () => {
    expect(ev('=COUNTIF(B2:B6,"Nausea")')).toBe(3);
    expect(ev('=COUNTIF(C2:C6,">=3")')).toBe(2);
    expect(ev('=SUMIF(C2:C6,">1")')).toBe(10);
    expect(ev('=COUNTIFS(A2:A6,"S-01",C2:C6,">=2")')).toBe(2);
    expect(ev('=SUMIFS(C2:C6,B2:B6,"Nausea")')).toBe(5);
    expect(ev('=AVERAGEIFS(C2:C6,B2:B6,"Nausea")')).toBeCloseTo(5 / 3, 10);
    expect(ev('=MAXIFS(C2:C6,A2:A6,"S-02")')).toBe(3);
    expect(ev('=COUNTIF(B2:B6,"Na*")')).toBe(3);
  });
  it('looks values up', () => {
    expect(ev('=XLOOKUP("Fatigue",B2:B6,C2:C6)')).toBe(3);
    expect(ev('=XLOOKUP("Missing",B2:B6,C2:C6,"not found")')).toBe('not found');
    expect((ev('=XLOOKUP("Missing",B2:B6,C2:C6)') as ExcelError).code).toBe('#N/A');
    expect(ev('=INDEX(C2:C6,MATCH("Rash",B2:B6,0))')).toBe(3);
    expect(ev('=VLOOKUP("S-02",A2:D6,3,FALSE)')).toBe(1);
  });
  it('treats ISO dates as serial numbers', () => {
    expect(ev('=D3-D2')).toBe(14);
    expect(ev('=YEAR(D2)')).toBe(2023);
    expect(ev('=MONTH(D2)')).toBe(3);
    expect(ev('=DAY(D2)')).toBe(6);
    expect(ev('=DATE(2023,3,6)')).toBe(dateToSerial(2023, 3, 6));
    expect(ev('=DATEDIF(D2,D5,"D")')).toBe(40);
    expect(ev('=TEXT(D2,"yyyy-mm-dd")')).toBe('2023-03-06');
  });
  it('rounds half away from zero, like Excel (and SAS)', () => {
    expect(ev('=ROUND(2.5,0)')).toBe(3);
    expect(ev('=ROUND(-2.5,0)')).toBe(-3);
    expect(ev('=ROUND(2.675,2)')).toBe(2.68);
    expect(ev('=ROUNDDOWN(2.9,0)')).toBe(2);
  });
  it('reports unknown functions and bad references', () => {
    expect((ev('=NOSUCHFN(1)') as ExcelError).code).toBe('#NAME?');
    expect((ev('=IFERROR(1/0,"safe")') as unknown) as string).toBe('safe');
  });

  // Excel's comparison operators do NOT coerce across types: they order
  // number < text < boolean. This is why a number stored as text never equals
  // the number, which is one of the most common silent reconciliation failures.
  describe('comparison operators are type-aware, like Excel', () => {
    it('never treats a number as equal to the same digits as text', () => {
      expect(ev('="16"=16')).toBe(false);
      expect(ev('="16"<>16')).toBe(true);
      expect(ev('="0"=0')).toBe(false);
    });
    it('orders number < text < boolean', () => {
      expect(ev('=1<"a"')).toBe(true);
      expect(ev('="a"<TRUE')).toBe(true);
      expect(ev('=999999<"0"')).toBe(true);
      expect(ev('=TRUE>100')).toBe(true);
    });
    it('compares text case-insensitively but not space-insensitively', () => {
      expect(ev('="Nausea"="NAUSEA"')).toBe(true);
      expect(ev('="Nausea"="Nausea "')).toBe(false);
      expect(ev('=EXACT("Nausea","NAUSEA")')).toBe(false);
    });
    it('gives a blank cell the type of whatever it is compared against', () => {
      // H1 is empty in this fixture.
      expect(ev('=H1=0')).toBe(true);
      expect(ev('=H1=""')).toBe(true);
      expect(ev('=H1=FALSE')).toBe(true);
    });
    it('still coerces inside COUNTIF/SUMIFS criteria, where Excel does', () => {
      // C2:C6 holds grades as numbers; a text criterion must still match them.
      expect(ev('=COUNTIF(C2:C6,"2")')).toBe(2);
      expect(ev('=COUNTIF(C2:C6,2)')).toBe(2);
      expect(ev('=COUNTIF(C2:C6,">=3")')).toBe(2);
    });
  });
});
