/**
 * `npm run validate` — validates all curriculum content.
 *
 * Options:
 *   --quiet        only print errors
 *   --only <path>  only print issues for files whose path contains <path>
 */
import { validateContent } from './lib/content-validator.ts';

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;

const { issues, counts } = validateContent();
const shown = issues.filter((i) => (!quiet || i.level === 'error') && (!only || i.file.includes(only)));

const byFile = new Map<string, typeof issues>();
for (const i of shown) {
  if (!byFile.has(i.file)) byFile.set(i.file, []);
  byFile.get(i.file)!.push(i);
}
for (const [file, list] of byFile) {
  console.log(`\n\x1b[1m${file}\x1b[0m`);
  for (const i of list) {
    const tag = i.level === 'error' ? '\x1b[31merror  \x1b[0m' : '\x1b[33mwarning\x1b[0m';
    console.log(`  ${tag} ${i.message}`);
  }
}

const errors = issues.filter((i) => i.level === 'error').length;
const warnings = issues.filter((i) => i.level === 'warning').length;
console.log('\nContent summary:');
console.log(
  Object.entries(counts)
    .map(([k, v]) => `  ${k.padEnd(14)} ${v}`)
    .join('\n'),
);
console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors > 0 ? 1 : 0);
