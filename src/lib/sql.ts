/**
 * In-browser SQLite (sql.js / WebAssembly). The WASM binary and the study
 * databases are bundled with the app, so SQL works fully offline.
 *
 * Each database is opened twice: a pristine copy used for reference answers
 * and a workspace copy the learner can modify (and reset).
 */
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { SqlDatabase } from '../content/schema';

const dbUrls = import.meta.glob<string>('/data/*/*.sqlite', { query: '?url', import: 'default', eager: true });

const DB_FILES: Record<SqlDatabase, string> = {
  oncology: '/data/oncology/cbx417.sqlite',
  cardio: '/data/cardio/cardio.sqlite',
  manufacturing: '/data/manufacturing/manufacturing.sqlite',
};

export const DB_LABELS: Record<SqlDatabase, string> = {
  oncology: 'CBX417-301 oncology study (SDTM + ADaM)',
  cardio: 'VTX-221 cardiovascular trial',
  manufacturing: 'Biologics manufacturing process',
};

let sqlPromise: Promise<SqlJsStatic> | null = null;
function sqljs() {
  sqlPromise ??= initSqlJs({ locateFile: () => wasmUrl });
  return sqlPromise;
}

const bytesCache = new Map<SqlDatabase, Promise<Uint8Array>>();
function dbBytes(name: SqlDatabase): Promise<Uint8Array> {
  let p = bytesCache.get(name);
  if (!p) {
    const url = dbUrls[DB_FILES[name]];
    if (!url) return Promise.reject(new Error(`The ${name} database has not been generated yet (run npm run data).`));
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load ${url} (${r.status})`);
        return r.arrayBuffer();
      })
      .then((b) => new Uint8Array(b));
    bytesCache.set(name, p);
    p.catch(() => bytesCache.delete(name));
  }
  return p;
}

export function isDatabaseAvailable(name: SqlDatabase): boolean {
  return !!dbUrls[DB_FILES[name]];
}

const pristine = new Map<SqlDatabase, Promise<Database>>();
const workspace = new Map<SqlDatabase, Promise<Database>>();

async function open(name: SqlDatabase): Promise<Database> {
  const [SQL, bytes] = await Promise.all([sqljs(), dbBytes(name)]);
  return new SQL.Database(bytes);
}

export function getReferenceDb(name: SqlDatabase): Promise<Database> {
  let p = pristine.get(name);
  if (!p) {
    p = open(name);
    pristine.set(name, p);
  }
  return p;
}

export function getWorkspaceDb(name: SqlDatabase): Promise<Database> {
  let p = workspace.get(name);
  if (!p) {
    p = open(name);
    workspace.set(name, p);
  }
  return p;
}

export async function resetWorkspace(name: SqlDatabase): Promise<void> {
  const old = workspace.get(name);
  workspace.delete(name);
  if (old) (await old).close();
}

export interface QueryResult {
  columns: string[];
  rows: (string | number | null)[][];
  /** Statements executed (for multi-statement input). */
  statements: number;
  ms: number;
  truncated: boolean;
}

const MAX_ROWS = 5000;

export function runQuery(db: Database, sql: string): QueryResult {
  const t0 = performance.now();
  const results = db.exec(sql);
  const last = results[results.length - 1];
  const ms = performance.now() - t0;
  if (!last) return { columns: [], rows: [], statements: results.length, ms, truncated: false };
  const rows = last.values.map((r) => r.map((v) => (v instanceof Uint8Array ? '[blob]' : (v as string | number | null))));
  return {
    columns: last.columns,
    rows: rows.slice(0, MAX_ROWS),
    statements: results.length,
    ms,
    truncated: rows.length > MAX_ROWS,
  };
}

export interface Schema {
  tables: { name: string; columns: { name: string; type: string }[]; rows: number }[];
}

export async function getSchema(name: SqlDatabase): Promise<Schema> {
  const db = await getReferenceDb(name);
  const tables = runQuery(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").rows.map((r) => String(r[0]));
  return {
    tables: tables.map((t) => {
      const cols = runQuery(db, `PRAGMA table_info("${t.replace(/"/g, '""')}")`).rows.map((r) => ({ name: String(r[1]), type: String(r[2] || '') }));
      const n = Number(runQuery(db, `SELECT COUNT(*) FROM "${t.replace(/"/g, '""')}"`).rows[0]?.[0] ?? 0);
      return { name: t, columns: cols, rows: n };
    }),
  };
}

/* ------------------------- Result-set comparison ------------------------ */

function normValue(v: string | number | null): string {
  if (v === null) return '∅';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
  const trimmed = v.trim();
  const n = Number(trimmed);
  if (trimmed !== '' && Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(trimmed)) return Number.isInteger(n) ? String(n) : String(Math.round(n * 1e6) / 1e6);
  return trimmed;
}

export interface CompareOutcome {
  match: boolean;
  reason?: string;
}

export function compareResults(
  learner: QueryResult,
  reference: QueryResult,
  opts: { orderMatters: boolean; compareColumns: boolean },
): CompareOutcome {
  if (opts.compareColumns) {
    const a = learner.columns.map((c) => c.toLowerCase());
    const b = reference.columns.map((c) => c.toLowerCase());
    if (a.join('|') !== b.join('|')) return { match: false, reason: `Expected columns (${reference.columns.join(', ')}), got (${learner.columns.join(', ')}).` };
  }
  if (learner.columns.length !== reference.columns.length)
    return { match: false, reason: `Expected ${reference.columns.length} column(s), got ${learner.columns.length}.` };
  if (learner.rows.length !== reference.rows.length)
    return { match: false, reason: `Expected ${reference.rows.length} row(s), got ${learner.rows.length}.` };
  const key = (r: (string | number | null)[]) => r.map(normValue).join('␟');
  const a = learner.rows.map(key);
  const b = reference.rows.map(key);
  if (opts.orderMatters) {
    const i = a.findIndex((x, idx) => x !== b[idx]);
    if (i >= 0) return { match: false, reason: `Row ${i + 1} differs (order matters for this task).` };
    return { match: true };
  }
  const counts = new Map<string, number>();
  for (const x of b) counts.set(x, (counts.get(x) ?? 0) + 1);
  for (const x of a) {
    const c = counts.get(x);
    if (!c) return { match: false, reason: 'Your result contains rows that the expected result does not.' };
    counts.set(x, c - 1);
  }
  return { match: true };
}
