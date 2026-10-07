/**
 * Small teaching datasets used for hand calculations in lessons and widgets.
 * Deterministic: these are fixed tables, not simulated data.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = join(ROOT, 'data', 'teaching');
mkdirSync(OUT, { recursive: true });

const km12 = [
  ['T-01', 2, 1, 'A'],
  ['T-02', 3, 1, 'A'],
  ['T-03', 4, 0, 'A'],
  ['T-04', 5, 1, 'A'],
  ['T-05', 6, 1, 'A'],
  ['T-06', 6, 0, 'B'],
  ['T-07', 8, 1, 'B'],
  ['T-08', 9, 0, 'B'],
  ['T-09', 11, 1, 'B'],
  ['T-10', 13, 0, 'B'],
  ['T-11', 15, 1, 'B'],
  ['T-12', 18, 0, 'B'],
];

const csv = (rows: (string | number)[][], header: string[]) => [header.join(','), ...rows.map((r) => r.join(','))].join('\n') + '\n';

writeFileSync(join(OUT, 'km12.csv'), csv(km12, ['SUBJ', 'TIME_MONTHS', 'EVENT', 'ARM']));

const manifest = {
  study: 'teaching',
  title: 'Teaching datasets',
  description:
    'Tiny fixed datasets used for hand calculations in lessons and interactive widgets, so the same numbers can be reproduced in SAS, R and Python.',
  synthetic: true as const,
  generator: 'scripts/data/teaching/generate.ts',
  seed: 'fixed',
  datasets: [
    {
      id: 'teaching/km12',
      layer: 'teaching' as const,
      name: 'KM12',
      label: 'Twelve-subject survival dataset for Kaplan–Meier by hand',
      file: 'km12.csv',
      rows: km12.length,
      keys: ['SUBJ'],
      structure: 'One record per subject',
      description:
        'Twelve subjects with follow-up times in months. Includes a tie between an event and a censoring at month 6, so the convention that events precede censorings at the same time can be demonstrated. Kaplan–Meier median = 11 months.',
      columns: [
        { name: 'SUBJ', label: 'Subject identifier', type: 'char' as const, role: 'Identifier' },
        { name: 'TIME_MONTHS', label: 'Time to event or censoring (months)', type: 'num' as const, role: 'Timing' },
        { name: 'EVENT', label: 'Event indicator (1 = event, 0 = censored)', type: 'num' as const, role: 'Result', notes: 'Note that ADaM ADTTE uses CNSR with the opposite convention (0 = event).' },
        { name: 'ARM', label: 'Arbitrary group for two-sample exercises', type: 'char' as const, role: 'Grouping' },
      ],
    },
  ],
};
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(
  join(OUT, 'README.md'),
  `# Teaching datasets\n\nFixed (not simulated) datasets used for hand calculations.\n\n- \`km12.csv\` — 12 subjects, months to event/censoring. Kaplan–Meier median 11 months; a tie between an event and a censoring at month 6.\n\nRegenerate with \`npx tsx scripts/data/teaching/generate.ts\`.\n`,
);
console.log('teaching datasets written');
