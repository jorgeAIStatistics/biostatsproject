/**
 * `npm run capstones` — regenerate the starter folder for every capstone.
 *
 *   npx tsx scripts/tools/gen-capstone-starters.ts
 *
 * Each capstone in content/capstones/capstones.yaml declares a `starter` folder. This script writes
 * that folder's README.md, .gitignore and directory skeleton **from the capstone definition itself**,
 * so the brief a learner reads on disk can never drift away from the one the app shows.
 *
 * Hand-written starter code (stubs, fixtures, checklists) lives alongside and is never overwritten:
 * the script only manages the files it lists in MANAGED, and leaves everything else alone.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { CapstoneFileSchema, type Capstone } from '../../src/content/schema.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');

/** Files this script owns. Anything else in a starter folder is hand-written and left untouched. */
const MANAGED = ['README.md', '.gitignore'];

const raw = parseYaml(readFileSync(join(ROOT, 'content', 'capstones', 'capstones.yaml'), 'utf8'));
const { capstones } = CapstoneFileSchema.parse(raw);

/** Which language the deliverables actually call for, used to pick the directory skeleton. */
function languages(c: Capstone): string[] {
  const text = (c.objective + c.deliverables.join(' ') + c.steps.map((s) => s.body).join(' ')).toLowerCase();
  const out: string[] = [];
  if (/\br\b|ggplot|dplyr|tidyverse|survival/.test(text)) out.push('R');
  if (/python|pandas|scikit|matplotlib/.test(text)) out.push('Python');
  if (/\bsas\b|proc /.test(text)) out.push('SAS');
  return out.length ? out : ['R'];
}

function readme(c: Capstone): string {
  const langs = languages(c);
  const dirs = langs.map((l) => `\`${l.toLowerCase()}/\``).join(', ');

  const steps = c.steps
    .map((s, i) => {
      const body = s.body.trim().split('\n').map((l) => (l.trim() ? l : '')).join('\n');
      return `### ${i + 1}. ${s.title}\n\n${body}\n\n**Done when:** ${s.done}`;
    })
    .join('\n\n');

  const rubric = c.rubric.map((r) => `| ${r.criterion} | ${r.description.trim().replace(/\n+/g, ' ')} |`).join('\n');
  const deliverables = c.deliverables.map((d) => `- ${d.trim()}`).join('\n');
  const datasets = c.datasets.length
    ? c.datasets
        .map((d) => {
          const [study, ...rest] = d.split('/');
          return `| \`${d}\` | \`data/${study}/\` — see that study's \`manifest.json\` for ${rest.join('/')} |`;
        })
        .join('\n')
    : '| — | This capstone uses datasets you generate or assemble yourself. |';

  return `# Capstone ${c.number} — ${c.title}

> ${c.summary}

**Difficulty:** ${c.difficulty} · **Estimated effort:** ${c.hours} hours

---

## Objective

${c.objective.trim()}

## Why this matters

${c.relevance.trim()}

---

## Data

Everything is **synthetic**. Read the \`README.md\` and \`manifest.json\` in each study folder before you
start — they document every column, its origin and its derivation.

| Dataset id | Where it lives |
|---|---|
${datasets}

Regenerate any study from scratch with \`npm run data\`.

---

## Deliverables

${deliverables}

---

## Steps

${steps}

---

## How you will be assessed

| Criterion | What good looks like |
|---|---|
${rubric}

---

## Suggested layout

This folder is a starting point, not a cage. Rearrange it if you have a better idea — but keep the
pipeline **rerunnable from scratch with no manual steps**, because that is what is being assessed.

\`\`\`
${c.starter?.split('/').pop() ?? c.id}/
  README.md          this brief
${langs.map((l) => `  ${l.toLowerCase()}/${' '.repeat(Math.max(0, 16 - l.length - 1))}your ${l} code`).join('\n')}
  output/            tables, figures and datasets your code writes
  notes.md           decisions, assumptions, and anything you had to guess
\`\`\`

Work in ${dirs} as the deliverables require.

\`output/\` is git-ignored: everything in it must be reproducible by rerunning your code. If something
in there cannot be regenerated, it belongs in version control instead.

---

## If you publish this

${c.portfolio.tagline}

Suggested repository name: \`${c.portfolio.repoName}\`

**State the limitations honestly.** Copy this into your README:

> ${c.portfolio.limitations.trim().replace(/\n+/g, '\n> ')}

Do not describe this work as submission-ready, validated, GMP-compliant or FDA-anything. It is a
teaching exercise on synthetic data, and saying so plainly is more impressive to an interviewer than
overclaiming.

---

<sub>Generated from \`content/capstones/capstones.yaml\` by \`scripts/tools/gen-capstone-starters.ts\`.
Edit the YAML, not this file — \`npm run capstones\` overwrites it.</sub>
`;
}

const GITIGNORE = `# Reproducible outputs — regenerate by rerunning the pipeline.
output/
!output/.gitkeep

# Language artefacts
__pycache__/
*.pyc
.Rhistory
.RData
.Rproj.user/
*.lst
*.log
renv/library/
.venv/
.ipynb_checkpoints/
.DS_Store
`;

let written = 0;
for (const c of capstones) {
  if (!c.starter) continue;
  const dir = join(ROOT, c.starter);
  mkdirSync(dir, { recursive: true });

  for (const lang of languages(c)) mkdirSync(join(dir, lang.toLowerCase()), { recursive: true });
  mkdirSync(join(dir, 'output'), { recursive: true });
  if (!existsSync(join(dir, 'output', '.gitkeep'))) writeFileSync(join(dir, 'output', '.gitkeep'), '');

  writeFileSync(join(dir, 'README.md'), readme(c));
  writeFileSync(join(dir, '.gitignore'), GITIGNORE);

  // notes.md is the learner's file: create it once, never overwrite.
  const notes = join(dir, 'notes.md');
  if (!existsSync(notes)) {
    writeFileSync(
      notes,
      `# Notes — ${c.title}\n\nDecisions, assumptions, and anything you had to guess.\n\n` +
        `Write these down as you go. When someone asks why a number came out the way it did, this file is\n` +
        `the answer — and on a real study it is the difference between a finding you can defend and one you\n` +
        `cannot.\n\n## Decisions\n\n## Assumptions\n\n## Open questions\n`,
    );
  }
  written++;
}

console.log(`capstone starters: ${written} folders written (managed files: ${MANAGED.join(', ')}).`);
