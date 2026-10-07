/**
 * Minimal RFC 4180 CSV writer/reader (UTF-8, no BOM, LF line endings, header row,
 * empty field = missing). Numbers must be pre-formatted by the caller when a
 * specific precision matters; `fmt` helpers below do that deterministically.
 */

export type Cell = string | number | null | undefined;
export type Row = Record<string, Cell>;

export interface Table {
  name: string;
  columns: string[];
  rows: Row[];
}

function cellText(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`non-finite number in CSV: ${v}`);
    return String(v);
  }
  return v;
}

function quote(s: string): string {
  if (s === '') return '';
  if (/[",\r\n]/.test(s) || s !== s.trim()) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(t: Table): string {
  const out: string[] = [t.columns.map(quote).join(',')];
  for (const r of t.rows) out.push(t.columns.map((c) => quote(cellText(r[c]))).join(','));
  return out.join('\n') + '\n';
}

/** Parse RFC 4180 text into a header and string rows (missing = ''). */
export function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return { header, rows };
}

/** Fixed-decimal formatting that never prints "-0". */
export function fixed(x: number, digits: number): string {
  const s = x.toFixed(digits);
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s;
}

/** Round to `digits` decimals and return a number (trailing zeros dropped in CSV). */
export function round(x: number, digits: number): number {
  const f = 10 ** digits;
  const r = Math.round(x * f + (x >= 0 ? 1e-9 : -1e-9)) / f;
  return Object.is(r, -0) ? 0 : r;
}
