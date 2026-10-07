import type { Sheet } from '../../../content/schema';

/** Default sheet used when a lesson does not name one. */
export const DEFAULT_SHEET: Sheet = {
  id: 'built-in',
  title: 'Lab results extract',
  description: 'A small central-lab extract, exactly as it often arrives: one row per test per visit, text dates, and a units column you must not ignore.',
  columns: ['SUBJID', 'VISIT', 'TEST', 'RESULT', 'UNIT', 'COLLECTED'],
  rows: [
    ['1012-0007', 'SCREENING', 'ALT', 28, 'U/L', '2023-03-01'],
    ['1012-0007', 'CYCLE 1 DAY 1', 'ALT', 34, 'U/L', '2023-03-06'],
    ['1012-0007', 'CYCLE 2 DAY 1', 'ALT', 96, 'U/L', '2023-03-27'],
    ['1012-0011', 'SCREENING', 'ALT', 22, 'U/L', '2023-03-02'],
    ['1012-0011', 'CYCLE 1 DAY 1', 'ALT', 25, 'U/L', '2023-03-08'],
    ['1012-0011', 'CYCLE 2 DAY 1', 'ALT', 31, 'U/L', '2023-03-29'],
    ['1023-0004', 'SCREENING', 'ALT', 41, 'U/L', '2023-04-11'],
    ['1023-0004', 'CYCLE 1 DAY 1', 'ALT', 45, 'U/L', '2023-04-17'],
    ['1023-0004', 'CYCLE 2 DAY 1', 'ALT', 210, 'U/L', '2023-05-08'],
  ],
  formats: {},
  tasks: [
    {
      prompt: 'In **H2**, count how many ALT results exceed 3× the upper limit of normal (ULN = 35 U/L for this assay), i.e. results above 105.',
      cell: 'H2',
      expected: 1,
      tolerance: 0,
      hint: 'COUNTIF takes a range and a criterion written as text, e.g. `">105"`.',
      solution: '=COUNTIF(D2:D10,">105")',
    },
    {
      prompt: 'In **H3**, compute the mean ALT at CYCLE 2 DAY 1 only.',
      cell: 'H3',
      expected: 112.33333,
      tolerance: 0.01,
      hint: 'AVERAGEIFS(average_range, criteria_range, criteria) — the average range comes first.',
      solution: '=AVERAGEIFS(D2:D10,B2:B10,"CYCLE 2 DAY 1")',
    },
    {
      prompt: 'In **H4**, return the CYCLE 2 DAY 1 result for subject 1023-0004 using XLOOKUP on a combined key.',
      cell: 'H4',
      expected: 210,
      tolerance: 0,
      hint: 'Build the key with & : `XLOOKUP("1023-0004CYCLE 2 DAY 1", A2:A10&B2:B10, D2:D10)` does not work in this sandbox — instead look up within the filtered rows using INDEX/MATCH on two criteria, or use MAXIFS.',
      solution: '=MAXIFS(D2:D10,A2:A10,"1023-0004",B2:B10,"CYCLE 2 DAY 1")',
    },
    {
      prompt: 'In **H5**, compute the days between screening and CYCLE 2 DAY 1 collection for subject 1012-0007.',
      cell: 'H5',
      expected: 26,
      tolerance: 0,
      hint: 'Dates in text form become serial numbers here; subtract the two cells directly.',
      solution: '=F4-F2',
    },
  ],
};
