/**
 * `npm run data` — regenerates every synthetic dataset.
 *
 * Each dataset has its own deterministic generator at scripts/data/<study>/generate.ts.
 * Generators are discovered automatically and run one after another, so adding a
 * dataset never requires editing this file.
 */
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2);

const studies = readdirSync(here)
  .filter((d) => statSync(join(here, d)).isDirectory() && existsSync(join(here, d, 'generate.ts')))
  .filter((d) => only.length === 0 || only.includes(d))
  .sort();

let failed = 0;
for (const study of studies) {
  const started = Date.now();
  console.log(`\n▶ ${study}`);
  const res = spawnSync('npx', ['tsx', join(here, study, 'generate.ts')], { stdio: 'inherit' });
  if (res.status !== 0) {
    failed++;
    console.error(`✖ ${study} failed (exit ${res.status})`);
  } else {
    console.log(`✓ ${study} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  }
}
if (studies.length === 0) console.log('No generators found in scripts/data/*/generate.ts');
process.exit(failed ? 1 : 0);
