/**
 * CBX417-301 synthetic oncology trial generator.
 *
 *   npx tsx scripts/data/oncology/generate.ts [--seed N] [--out DIR] [--no-r] [--no-sqlite]
 *
 * truth (truth.ts, course.ts, findings.ts, conmed.ts)
 *   → raw EDC/vendor exports with documented injected problems (raw.ts)
 *   → SDTM from the corrected truth + lineage (sdtm.ts)
 *   → ADaM from SDTM (adam.ts)
 *   → manifest.json, README.md, answer key, SQLite, consistency checks,
 *     and STUDY_FACTS.md computed by R (verify.R) when Rscript is available.
 * Deterministic: the same seed gives byte-identical files.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DEFAULT_SEED } from './config.ts';
import { buildTruth } from './truth.ts';
import { buildRaw, rawTables } from './raw.ts';
import { buildSdtm } from './sdtm.ts';
import { buildAdam } from './adam.ts';
import { toCsv, type Table } from './csv.ts';
import { buildManifest } from './manifest.ts';
import { answerKeyReadme, datasetReadme } from './docs.ts';
import { buildSqlite } from './sqlite.ts';
import { runChecks } from './check.ts';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..', '..');
const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const seed = Number(opt('--seed') ?? DEFAULT_SEED);
const OUT = opt('--out') ?? join(ROOT, 'data', 'oncology');
const noR = args.includes('--no-r');
const noSqlite = args.includes('--no-sqlite');

const t0 = Date.now();
const truth = buildTruth(seed);
const raw = buildRaw(truth);
const sdtm = buildSdtm(truth, raw);
const adam = buildAdam(sdtm.tables);
const rawT = rawTables(raw);

for (const d of ['raw', 'sdtm', 'adam', 'answer-key', 'lineage']) rmSync(join(OUT, d), { recursive: true, force: true });
for (const f of ['cbx417.sqlite', 'manifest.json']) rmSync(join(OUT, f), { force: true });
const write = (rel: string, text: string) => {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
};
const writeTables = (dir: string, tables: Table[]) => {
  for (const t of tables) write(`${dir}/${t.name}.csv`, toCsv(t));
};
writeTables('raw', rawT);
writeTables('sdtm', sdtm.tables);
writeTables('adam', adam);
write('answer-key/data_issues.csv', toCsv(raw.issuesTable));
write('answer-key/README.md', answerKeyReadme(raw));
write('lineage/sdtm_raw_map.csv', toCsv(sdtm.lineage));
const manifest = buildManifest({ seed, raw: rawT, sdtm: sdtm.tables, adam, issues: raw.issuesTable, lineage: sdtm.lineage });
write('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
write('README.md', datasetReadme({ seed, raw: rawT, sdtm: sdtm.tables, adam, truth, rawResult: raw }));
if (!noSqlite) buildSqlite(join(OUT, 'cbx417.sqlite'), [...sdtm.tables, ...adam], manifest);

const problems = runChecks(OUT);
if (problems.length) {
  console.error(`✖ ${problems.length} consistency problem(s):\n  ${problems.slice(0, 40).join('\n  ')}`);
  process.exit(1);
}
console.log(`CBX417-301 generated with seed ${seed} in ${((Date.now() - t0) / 1000).toFixed(1)} s → ${OUT}`);
for (const [layer, ts] of [['raw', rawT], ['sdtm', sdtm.tables], ['adam', adam]] as const)
  console.log(`  ${layer.padEnd(5)} ${ts.map((t) => `${t.name}(${t.rows.length})`).join(' ')}`);

if (!noR) {
  const verify = join(here, 'verify.R');
  const res = spawnSync('Rscript', [verify, OUT], { encoding: 'utf8' });
  if (res.error || res.status !== 0) {
    console.warn(`! R verification not run or failed (${res.error?.message ?? `exit ${res.status}`}); STUDY_FACTS.md not refreshed.`);
    if (res.stderr) console.warn(res.stderr.split('\n').slice(-15).join('\n'));
    if (!existsSync(join(OUT, 'STUDY_FACTS.md'))) process.exit(1);
  } else console.log(res.stdout.trim().split('\n').slice(-3).join('\n'));
}
