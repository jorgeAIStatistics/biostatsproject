/**
 * Build data/oncology/cbx417.sqlite from the SDTM and ADaM tables using the
 * sqlite3 CLI. Tables are created with explicit column types (from the
 * manifest, refined by the data) so numeric columns compare and sort as
 * numbers in the SQL lab, and rows are inserted with real NULLs.
 */
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import type { Table, Cell } from './csv.ts';

interface ManifestLike {
  datasets: { name: string; layer: string; columns: { name: string; type: string }[] }[];
}

const SQLITE = '/usr/bin/sqlite3';

function sqlType(t: Table, col: string, declared: string | undefined): string {
  if (declared && declared !== 'num') return 'TEXT';
  let seen = false;
  let allInt = true;
  for (const r of t.rows) {
    const v = r[col];
    if (v === null || v === undefined || v === '') continue;
    seen = true;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return 'TEXT';
    if (!Number.isInteger(n)) allInt = false;
  }
  if (!seen) return declared === 'num' ? 'REAL' : 'TEXT';
  return allInt ? 'INTEGER' : 'REAL';
}

const lit = (v: Cell): string => {
  if (v === null || v === undefined || v === '') return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${v.replace(/'/g, "''")}'`;
};

export function buildSqlite(path: string, tables: Table[], manifest: ManifestLike) {
  rmSync(path, { force: true });
  const declared = new Map<string, Map<string, string>>();
  for (const d of manifest.datasets) declared.set(d.name, new Map(d.columns.map((c) => [c.name, c.type])));
  const sql: string[] = ['PRAGMA journal_mode=OFF;', 'PRAGMA synchronous=OFF;', 'BEGIN;'];
  for (const t of tables) {
    const decl = declared.get(t.name);
    const types = t.columns.map((c) => `"${c}" ${sqlType(t, c, decl?.get(c))}`);
    sql.push(`CREATE TABLE ${t.name} (${types.join(', ')});`);
    const cols = t.columns.map((c) => `"${c}"`).join(',');
    for (let i = 0; i < t.rows.length; i += 400) {
      const chunk = t.rows.slice(i, i + 400).map((r) => `(${t.columns.map((c) => lit(r[c])).join(',')})`);
      sql.push(`INSERT INTO ${t.name} (${cols}) VALUES ${chunk.join(',')};`);
    }
  }
  sql.push('COMMIT;', 'VACUUM;');
  const res = spawnSync(SQLITE, [path], { input: sql.join('\n'), encoding: 'utf8', maxBuffer: 1 << 28 });
  if (res.error) throw new Error(`sqlite3 failed: ${res.error.message}`);
  if (res.status !== 0) throw new Error(`sqlite3 exited ${res.status}: ${res.stderr?.slice(0, 500)}`);
}
