/**
 * Dataset access for the synthetic studies under /data.
 *
 * Manifests (data/<study>/manifest.json) describe datasets and columns; CSV
 * files are loaded lazily (bundled as raw text chunks) and parsed with
 * Papa Parse. Empty strings become null. Numeric columns (per manifest type
 * "num") are converted to numbers.
 */
import Papa from 'papaparse';
import { useEffect, useState } from 'react';
import type { DatasetManifest, DatasetMeta } from '../content/schema';

const manifestLoaders = import.meta.glob<DatasetManifest>('/data/*/manifest.json', { import: 'default' });
const csvLoaders = import.meta.glob<string>('/data/**/*.csv', { query: '?raw', import: 'default' });

export type Cell = string | number | null;
export type Row = Record<string, Cell>;

export interface LoadedDataset {
  meta: DatasetMeta;
  study: string;
  columns: string[];
  rows: Row[];
}

let manifestsPromise: Promise<DatasetManifest[]> | null = null;

export function loadManifests(): Promise<DatasetManifest[]> {
  manifestsPromise ??= Promise.all(
    Object.entries(manifestLoaders)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, load]) => load()),
  );
  return manifestsPromise;
}

export async function findDatasetMeta(id: string): Promise<{ meta: DatasetMeta; study: string } | null> {
  const manifests = await loadManifests();
  for (const m of manifests) {
    const meta = m.datasets.find((d) => d.id === id);
    if (meta) return { meta, study: m.study };
  }
  return null;
}

const datasetCache = new Map<string, Promise<LoadedDataset>>();

export function parseCsv(text: string, numericColumns?: Set<string>): { columns: string[]; rows: Row[] } {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  });
  const columns = res.meta.fields ?? [];
  const rows: Row[] = res.data.map((r) => {
    const out: Row = {};
    for (const c of columns) {
      const v = r[c];
      if (v === undefined || v === '') out[c] = null;
      else if (numericColumns?.has(c)) {
        const n = Number(v);
        out[c] = Number.isFinite(n) ? n : v;
      } else out[c] = v;
    }
    return out;
  });
  return { columns, rows };
}

export function loadDataset(id: string): Promise<LoadedDataset> {
  const cached = datasetCache.get(id);
  if (cached) return cached;
  const p = (async () => {
    const found = await findDatasetMeta(id);
    if (!found) throw new Error(`Dataset "${id}" is not in any manifest.`);
    const path = `/data/${found.study}/${found.meta.file}`;
    const loader = csvLoaders[path];
    if (!loader) throw new Error(`CSV file not found: ${path}`);
    const text = await loader();
    const numeric = new Set(found.meta.columns.filter((c) => c.type === 'num').map((c) => c.name));
    const { columns, rows } = parseCsv(text, numeric);
    return { meta: found.meta, study: found.study, columns, rows };
  })();
  datasetCache.set(id, p);
  p.catch(() => datasetCache.delete(id));
  return p;
}

/** Load a CSV by path relative to /data (for files not in a manifest). */
export async function loadCsvFile(path: string): Promise<{ columns: string[]; rows: Row[] }> {
  const loader = csvLoaders[`/data/${path}`];
  if (!loader) throw new Error(`CSV file not found: /data/${path}`);
  return parseCsv(await loader());
}

export function useDataset(id: string | undefined): { data?: LoadedDataset; error?: string; loading: boolean } {
  const [state, setState] = useState<{ data?: LoadedDataset; error?: string; loading: boolean }>({ loading: !!id });
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setState({ loading: true });
    loadDataset(id)
      .then((data) => alive && setState({ data, loading: false }))
      .catch((e: Error) => alive && setState({ error: e.message, loading: false }));
    return () => {
      alive = false;
    };
  }, [id]);
  return state;
}

export function useManifests(): DatasetManifest[] | undefined {
  const [m, setM] = useState<DatasetManifest[]>();
  useEffect(() => {
    let alive = true;
    loadManifests().then((x) => alive && setM(x));
    return () => {
      alive = false;
    };
  }, []);
  return m;
}

/* ---------------------------- Simple filters ---------------------------- */

export interface FilterClause {
  column: string;
  op: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains';
  value: string;
}

/** Parses the lesson filter mini-language: "SEX=F;AGE>=65". */
export function parseFilter(expr: string | undefined): FilterClause[] {
  if (!expr) return [];
  return expr
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^([A-Za-z0-9_]+)\s*(!=|>=|<=|=|>|<|~)\s*(.*)$/);
      if (!m) return null;
      return { column: m[1], op: (m[2] === '~' ? 'contains' : m[2]) as FilterClause['op'], value: m[3].trim() };
    })
    .filter((x): x is FilterClause => x !== null);
}

export function applyFilter(rows: Row[], clauses: FilterClause[]): Row[] {
  if (!clauses.length) return rows;
  return rows.filter((r) =>
    clauses.every(({ column, op, value }) => {
      const v = r[column];
      const num = Number(value);
      const numeric = typeof v === 'number' && Number.isFinite(num) && value !== '';
      switch (op) {
        case '=':
          return value === '' ? v === null : String(v ?? '') === value;
        case '!=':
          return value === '' ? v !== null : String(v ?? '') !== value;
        case 'contains':
          return String(v ?? '').toLowerCase().includes(value.toLowerCase());
        default: {
          if (v === null) return false;
          const a = numeric ? (v as number) : String(v);
          const b = numeric ? num : value;
          if (op === '>') return a > b;
          if (op === '>=') return a >= b;
          if (op === '<') return a < b;
          return a <= b;
        }
      }
    }),
  );
}

export function sortRows(rows: Row[], column: string, desc = false): Row[] {
  const dir = desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = a[column];
    const y = b[column];
    if (x === y) return 0;
    if (x === null) return -1 * dir; // missing sorts first (like SAS)
    if (y === null) return 1 * dir;
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
    return String(x).localeCompare(String(y), undefined, { numeric: true }) * dir;
  });
}

export function toCsv(columns: string[], rows: Row[]): string {
  return Papa.unparse({ fields: columns, data: rows.map((r) => columns.map((c) => r[c] ?? '')) });
}
