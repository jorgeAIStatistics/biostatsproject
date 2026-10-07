/**
 * A small spreadsheet formula engine: tokenizer, recursive-descent parser and
 * evaluator for the subset of Excel used in the Excel lab (see EXCEL_FUNCTIONS
 * in src/content/vocab.ts). Dates use Excel serial numbers with the
 * 1899-12-30 epoch, which reproduces Excel's values for dates from 1900-03-01.
 */
export type CellValue = number | string | boolean | null;
export type EvalValue = number | string | boolean | ExcelError | null | EvalValue[];

export class ExcelError {
  constructor(public code: string) {}
  toString() {
    return this.code;
  }
}

export const ERR = {
  div0: () => new ExcelError('#DIV/0!'),
  value: () => new ExcelError('#VALUE!'),
  ref: () => new ExcelError('#REF!'),
  name: () => new ExcelError('#NAME?'),
  na: () => new ExcelError('#N/A'),
  num: () => new ExcelError('#NUM!'),
};

/* ------------------------------ Cell addresses ------------------------------ */

export function colToIndex(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function indexToCol(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function parseRef(ref: string): { row: number; col: number } | null {
  const m = ref.replace(/\$/g, '').match(/^([A-Za-z]{1,3})(\d{1,5})$/);
  if (!m) return null;
  return { col: colToIndex(m[1]), row: Number(m[2]) - 1 };
}

export const cellName = (row: number, col: number) => `${indexToCol(col)}${row + 1}`;

/* --------------------------------- Dates ---------------------------------- */

const EPOCH = Date.UTC(1899, 11, 30);
export const dateToSerial = (y: number, m: number, d: number) => Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000);
export const serialToDate = (s: number) => new Date(EPOCH + Math.round(s) * 86400000);
export function parseDateString(v: string): number | null {
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return dateToSerial(Number(m[1]), Number(m[2]), Number(m[3]));
}

/* -------------------------------- Tokenizer -------------------------------- */

type Token = { t: 'num' | 'str' | 'op' | 'id' | 'ref' | 'range' | 'lparen' | 'rparen' | 'comma' | 'err'; v: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const isDigit = (c: string) => c >= '0' && c <= '9';
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') {
      i++;
      continue;
    }
    if (c === '"') {
      let s = '';
      i++;
      while (i < src.length) {
        if (src[i] === '"' && src[i + 1] === '"') {
          s += '"';
          i += 2;
        } else if (src[i] === '"') {
          i++;
          break;
        } else s += src[i++];
      }
      out.push({ t: 'str', v: s });
      continue;
    }
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      let s = '';
      while (i < src.length && (isDigit(src[i]) || src[i] === '.')) s += src[i++];
      if (src[i] === 'E' || src[i] === 'e') {
        s += src[i++];
        if (src[i] === '+' || src[i] === '-') s += src[i++];
        while (i < src.length && isDigit(src[i])) s += src[i++];
      }
      out.push({ t: 'num', v: s });
      continue;
    }
    if (c === '#') {
      const m = src.slice(i).match(/^#[A-Z0/]+[!?]/);
      if (m) {
        out.push({ t: 'err', v: m[0] });
        i += m[0].length;
        continue;
      }
    }
    if (/[A-Za-z$_]/.test(c)) {
      let s = '';
      while (i < src.length && /[A-Za-z0-9$_.]/.test(src[i])) s += src[i++];
      // Range?
      if (src[i] === ':' && /^\$?[A-Za-z]{1,3}\$?\d+$/.test(s)) {
        let s2 = '';
        i++;
        while (i < src.length && /[A-Za-z0-9$]/.test(src[i])) s2 += src[i++];
        out.push({ t: 'range', v: `${s}:${s2}` });
        continue;
      }
      if (/^\$?[A-Za-z]{1,3}\$?\d+$/.test(s)) out.push({ t: 'ref', v: s });
      else if (/^(TRUE|FALSE)$/i.test(s)) out.push({ t: 'id', v: s.toUpperCase() });
      else out.push({ t: 'id', v: s.toUpperCase() });
      continue;
    }
    if (c === '(') {
      out.push({ t: 'lparen', v: c });
      i++;
      continue;
    }
    if (c === ')') {
      out.push({ t: 'rparen', v: c });
      i++;
      continue;
    }
    if (c === ',' || c === ';') {
      out.push({ t: 'comma', v: ',' });
      i++;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '<>') {
      out.push({ t: 'op', v: two });
      i += 2;
      continue;
    }
    if ('+-*/^&=<>%'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    throw new Error(`Unexpected character "${c}"`);
  }
  return out;
}

/* ---------------------------------- AST ----------------------------------- */

type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'err'; v: string }
  | { k: 'ref'; v: string }
  | { k: 'range'; v: string }
  | { k: 'call'; name: string; args: Node[] }
  | { k: 'bin'; op: string; l: Node; r: Node }
  | { k: 'un'; op: string; e: Node };

function parse(tokens: Token[]): Node {
  let p = 0;
  const peek = () => tokens[p];
  const eat = (t?: Token['t']) => {
    const tok = tokens[p];
    if (!tok || (t && tok.t !== t)) throw new Error(`Unexpected ${tok ? tok.v : 'end of formula'}`);
    p++;
    return tok;
  };
  function primary(): Node {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end of formula');
    if (tok.t === 'num') {
      p++;
      return { k: 'num', v: Number(tok.v) };
    }
    if (tok.t === 'str') {
      p++;
      return { k: 'str', v: tok.v };
    }
    if (tok.t === 'err') {
      p++;
      return { k: 'err', v: tok.v };
    }
    if (tok.t === 'ref') {
      p++;
      return { k: 'ref', v: tok.v };
    }
    if (tok.t === 'range') {
      p++;
      return { k: 'range', v: tok.v };
    }
    if (tok.t === 'lparen') {
      p++;
      const e = expr();
      eat('rparen');
      return e;
    }
    if (tok.t === 'id') {
      p++;
      if (tok.v === 'TRUE' || tok.v === 'FALSE') return { k: 'bool', v: tok.v === 'TRUE' };
      if (peek()?.t === 'lparen') {
        p++;
        const args: Node[] = [];
        if (peek()?.t !== 'rparen') {
          args.push(expr());
          while (peek()?.t === 'comma') {
            p++;
            args.push(expr());
          }
        }
        eat('rparen');
        return { k: 'call', name: tok.v, args };
      }
      return { k: 'str', v: tok.v };
    }
    if (tok.t === 'op' && (tok.v === '-' || tok.v === '+')) {
      p++;
      return { k: 'un', op: tok.v, e: primary() };
    }
    throw new Error(`Unexpected ${tok.v}`);
  }
  function power(): Node {
    const base = primary();
    if (peek()?.t === 'op' && peek().v === '^') {
      p++;
      return { k: 'bin', op: '^', l: base, r: power() };
    }
    return base;
  }
  function term(): Node {
    let l = power();
    while (peek()?.t === 'op' && (peek().v === '*' || peek().v === '/')) {
      const op = eat('op').v;
      l = { k: 'bin', op, l, r: power() };
    }
    return l;
  }
  function additive(): Node {
    let l = term();
    while (peek()?.t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = eat('op').v;
      l = { k: 'bin', op, l, r: term() };
    }
    return l;
  }
  function concat(): Node {
    let l = additive();
    while (peek()?.t === 'op' && peek().v === '&') {
      p++;
      l = { k: 'bin', op: '&', l, r: additive() };
    }
    return l;
  }
  function expr(): Node {
    let l = concat();
    while (peek()?.t === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(peek().v)) {
      const op = eat('op').v;
      l = { k: 'bin', op, l, r: concat() };
    }
    return l;
  }
  const e = expr();
  if (p < tokens.length) throw new Error(`Unexpected ${tokens[p].v}`);
  return e;
}

/* -------------------------------- Evaluator -------------------------------- */

export interface Grid {
  /** Raw cell values (formulas are strings starting with "="). */
  get(row: number, col: number): CellValue;
  rows: number;
  cols: number;
}

const num = (v: EvalValue): number | ExcelError => {
  if (v instanceof ExcelError) return v;
  if (v === null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (Array.isArray(v)) return v.length === 1 ? num(v[0]) : ERR.value();
  const d = parseDateString(v);
  if (d !== null) return d;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : ERR.value();
};

const text = (v: EvalValue): string => {
  if (v instanceof ExcelError) return v.code;
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
};

const flat = (v: EvalValue): EvalValue[] => (Array.isArray(v) ? v.flatMap(flat) : [v]);

function compare(a: EvalValue, b: EvalValue): number {
  const an = typeof a === 'number' ? a : null;
  const bn = typeof b === 'number' ? b : null;
  if (an !== null && bn !== null) return an - bn;
  return String(text(a)).toLowerCase().localeCompare(String(text(b)).toLowerCase());
}

/**
 * Rank of a value's type for Excel's comparison operators. Excel does not coerce across types when
 * `=`, `<` and friends appear in a formula: it orders number < text < boolean, so `="16"=16` is FALSE
 * and `=1<"a"` is TRUE. Blank compares as 0 against a number and as "" against text.
 *
 * This is deliberately NOT used by `matchCriteria`, because criteria arguments DO coerce —
 * `COUNTIF(range,"16")` matches the number 16. The two rules genuinely differ in Excel.
 */
const typeRank = (v: EvalValue): number => (typeof v === 'boolean' ? 2 : typeof v === 'number' ? 0 : 1);

function compareOperands(a: EvalValue, b: EvalValue): number {
  // A blank cell takes the type of whatever it is compared against.
  const an = a === null ? (typeof b === 'number' ? 0 : typeof b === 'boolean' ? false : '') : a;
  const bn = b === null ? (typeof a === 'number' ? 0 : typeof a === 'boolean' ? false : '') : b;
  const ra = typeRank(an);
  const rb = typeRank(bn);
  if (ra !== rb) return ra - rb;
  if (typeof an === 'boolean' && typeof bn === 'boolean') return (an ? 1 : 0) - (bn ? 1 : 0);
  if (typeof an === 'number' && typeof bn === 'number') return an - bn;
  return String(an).toLowerCase().localeCompare(String(bn).toLowerCase());
}

/** Excel criteria: 5, ">=5", "<>x", "abc", "a*" */
function matchCriteria(value: EvalValue, criteria: EvalValue): boolean {
  if (criteria instanceof ExcelError) return false;
  const c = typeof criteria === 'string' ? criteria.trim() : criteria;
  if (typeof c === 'string') {
    const m = c.match(/^(<=|>=|<>|=|<|>)(.*)$/);
    if (m) {
      const rhsRaw = m[2].trim();
      const rhs: EvalValue = rhsRaw === '' ? '' : Number.isFinite(Number(rhsRaw)) && rhsRaw !== '' ? Number(rhsRaw) : rhsRaw;
      const cmp = compare(value ?? '', rhs);
      switch (m[1]) {
        case '<=':
          return cmp <= 0;
        case '>=':
          return cmp >= 0;
        case '<>':
          return cmp !== 0;
        case '=':
          return cmp === 0;
        case '<':
          return cmp < 0;
        default:
          return cmp > 0;
      }
    }
    if (c.includes('*') || c.includes('?')) {
      const re = new RegExp(`^${c.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
      return re.test(text(value));
    }
    return text(value).toLowerCase() === c.toLowerCase();
  }
  return compare(value ?? '', c ?? '') === 0;
}

export function evaluateFormula(formula: string, grid: Grid, visiting = new Set<string>()): EvalValue {
  let ast: Node;
  try {
    ast = parse(tokenize(formula.replace(/^=/, '')));
  } catch {
    return ERR.name();
  }

  const cellValue = (ref: string): EvalValue => {
    const a = parseRef(ref);
    if (!a) return ERR.ref();
    if (a.row < 0 || a.col < 0 || a.row >= grid.rows || a.col >= grid.cols) return ERR.ref();
    const key = cellName(a.row, a.col);
    const raw = grid.get(a.row, a.col);
    if (typeof raw === 'string' && raw.startsWith('=')) {
      if (visiting.has(key)) return new ExcelError('#CIRCULAR!');
      visiting.add(key);
      const v = evaluateFormula(raw, grid, visiting);
      visiting.delete(key);
      return v;
    }
    if (typeof raw === 'string') {
      const d = parseDateString(raw);
      if (d !== null) return d;
    }
    return raw;
  };

  const rangeValues = (r: string): EvalValue[] => {
    const [a, b] = r.split(':');
    const from = parseRef(a);
    const to = parseRef(b);
    if (!from || !to) return [ERR.ref()];
    const out: EvalValue[] = [];
    for (let row = Math.min(from.row, to.row); row <= Math.max(from.row, to.row); row++)
      for (let col = Math.min(from.col, to.col); col <= Math.max(from.col, to.col); col++) out.push(cellValue(cellName(row, col)));
    return out;
  };

  function ev(n: Node): EvalValue {
    switch (n.k) {
      case 'num':
        return n.v;
      case 'str':
        return n.v;
      case 'bool':
        return n.v;
      case 'err':
        return new ExcelError(n.v);
      case 'ref':
        return cellValue(n.v);
      case 'range':
        return rangeValues(n.v);
      case 'un': {
        const v = num(ev(n.e));
        if (v instanceof ExcelError) return v;
        return n.op === '-' ? -v : v;
      }
      case 'bin': {
        const l = ev(n.l);
        const r = ev(n.r);
        if (l instanceof ExcelError) return l;
        if (r instanceof ExcelError) return r;
        if (n.op === '&') return text(l) + text(r);
        if (['=', '<>', '<', '>', '<=', '>='].includes(n.op)) {
          const c = compareOperands(l, r);
          switch (n.op) {
            case '=':
              return c === 0;
            case '<>':
              return c !== 0;
            case '<':
              return c < 0;
            case '>':
              return c > 0;
            case '<=':
              return c <= 0;
            default:
              return c >= 0;
          }
        }
        const a = num(l);
        const b = num(r);
        if (a instanceof ExcelError) return a;
        if (b instanceof ExcelError) return b;
        switch (n.op) {
          case '+':
            return a + b;
          case '-':
            return a - b;
          case '*':
            return a * b;
          case '/':
            return b === 0 ? ERR.div0() : a / b;
          case '^':
            return a ** b;
        }
        return ERR.value();
      }
      case 'call':
        return callFn(n.name, n.args);
    }
  }

  function args(list: Node[]): EvalValue[] {
    return list.map(ev);
  }

  function numbersOf(vals: EvalValue[]): number[] {
    return flat(vals).filter((v): v is number => typeof v === 'number');
  }

  function ifsFilter(pairs: EvalValue[][]): boolean[] {
    const n = pairs[0][0] ? flat(pairs[0][0]).length : 0;
    const keep = new Array(n).fill(true);
    for (const [rangeVal, crit] of pairs) {
      const values = flat(rangeVal);
      for (let i = 0; i < n; i++) if (!matchCriteria(values[i], crit as EvalValue)) keep[i] = false;
    }
    return keep;
  }

  function callFn(name: string, argNodes: Node[]): EvalValue {
    const A = () => args(argNodes);
    switch (name) {
      case 'SUM':
        return numbersOf(A()).reduce((a, b) => a + b, 0);
      case 'AVERAGE': {
        const v = numbersOf(A());
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : ERR.div0();
      }
      case 'MEDIAN': {
        const v = numbersOf(A()).sort((a, b) => a - b);
        if (!v.length) return ERR.num();
        const mid = Math.floor(v.length / 2);
        return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
      }
      case 'MIN': {
        const v = numbersOf(A());
        return v.length ? Math.min(...v) : 0;
      }
      case 'MAX': {
        const v = numbersOf(A());
        return v.length ? Math.max(...v) : 0;
      }
      case 'COUNT':
        return numbersOf(A()).length;
      case 'COUNTA':
        return flat(A()).filter((v) => v !== null && v !== '').length;
      case 'COUNTBLANK':
        return flat(A()).filter((v) => v === null || v === '').length;
      case 'STDEV':
      case 'STDEV.S': {
        const v = numbersOf(A());
        if (v.length < 2) return ERR.div0();
        const m = v.reduce((a, b) => a + b, 0) / v.length;
        return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
      }
      case 'VAR.S': {
        const v = numbersOf(A());
        if (v.length < 2) return ERR.div0();
        const m = v.reduce((a, b) => a + b, 0) / v.length;
        return v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1);
      }
      case 'ROUND':
      case 'ROUNDUP':
      case 'ROUNDDOWN': {
        const [v, d] = A();
        const x = num(v);
        const dd = num(d ?? 0);
        if (x instanceof ExcelError) return x;
        if (dd instanceof ExcelError) return dd;
        const f = 10 ** dd;
        if (name === 'ROUND') return (Math.sign(x) * Math.floor(Math.abs(x) * f + 0.5 + 1e-9)) / f;
        if (name === 'ROUNDUP') return (Math.sign(x) * Math.ceil(Math.abs(x) * f - 1e-9)) / f;
        return (Math.sign(x) * Math.floor(Math.abs(x) * f + 1e-9)) / f;
      }
      case 'ABS':
      case 'INT':
      case 'SQRT': {
        const x = num(A()[0]);
        if (x instanceof ExcelError) return x;
        return name === 'ABS' ? Math.abs(x) : name === 'INT' ? Math.floor(x) : x < 0 ? ERR.num() : Math.sqrt(x);
      }
      case 'MOD': {
        const [a, b] = A().map(num);
        if (a instanceof ExcelError) return a;
        if (b instanceof ExcelError) return b;
        return b === 0 ? ERR.div0() : a - b * Math.floor(a / b);
      }
      case 'POWER': {
        const [a, b] = A().map(num);
        if (a instanceof ExcelError) return a;
        if (b instanceof ExcelError) return b;
        return a ** b;
      }
      case 'IF': {
        const cond = ev(argNodes[0]);
        if (cond instanceof ExcelError) return cond;
        const truthy = typeof cond === 'boolean' ? cond : typeof cond === 'number' ? cond !== 0 : String(cond).toUpperCase() === 'TRUE';
        if (truthy) return argNodes[1] ? ev(argNodes[1]) : true;
        return argNodes[2] ? ev(argNodes[2]) : false;
      }
      case 'IFS': {
        for (let i = 0; i + 1 < argNodes.length; i += 2) {
          const c = ev(argNodes[i]);
          if (c instanceof ExcelError) return c;
          const truthy = typeof c === 'boolean' ? c : typeof c === 'number' ? c !== 0 : String(c).toUpperCase() === 'TRUE';
          if (truthy) return ev(argNodes[i + 1]);
        }
        return ERR.na();
      }
      case 'AND':
        return flat(A()).every((v) => (typeof v === 'boolean' ? v : num(v) !== 0));
      case 'OR':
        return flat(A()).some((v) => (typeof v === 'boolean' ? v : num(v) !== 0));
      case 'NOT': {
        const v = A()[0];
        return !(typeof v === 'boolean' ? v : num(v) !== 0);
      }
      case 'IFERROR': {
        const v = ev(argNodes[0]);
        return v instanceof ExcelError ? ev(argNodes[1]) : v;
      }
      case 'IFNA': {
        const v = ev(argNodes[0]);
        return v instanceof ExcelError && v.code === '#N/A' ? ev(argNodes[1]) : v;
      }
      case 'ISBLANK': {
        const v = A()[0];
        return v === null || v === '';
      }
      case 'ISNUMBER':
        return typeof A()[0] === 'number';
      case 'ISTEXT':
        return typeof A()[0] === 'string';
      case 'ISERROR':
        return A()[0] instanceof ExcelError;
      case 'COUNTIF':
      case 'SUMIF':
      case 'AVERAGEIF': {
        const a = A();
        const range = flat(a[0]);
        const crit = a[1];
        const sumRange = a[2] !== undefined ? flat(a[2]) : range;
        const idx = range.map((v, i) => (matchCriteria(v, crit) ? i : -1)).filter((i) => i >= 0);
        if (name === 'COUNTIF') return idx.length;
        const vals = idx.map((i) => sumRange[i]).filter((v): v is number => typeof v === 'number');
        if (name === 'SUMIF') return vals.reduce((x, y) => x + y, 0);
        return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : ERR.div0();
      }
      case 'COUNTIFS':
      case 'SUMIFS':
      case 'AVERAGEIFS':
      case 'MAXIFS':
      case 'MINIFS': {
        const a = A();
        const offset = name === 'COUNTIFS' ? 0 : 1;
        const pairs: EvalValue[][] = [];
        for (let i = offset; i + 1 < a.length; i += 2) pairs.push([a[i], a[i + 1]]);
        const keep = ifsFilter(pairs);
        if (name === 'COUNTIFS') return keep.filter(Boolean).length;
        const target = flat(a[0]);
        const vals = keep.map((k, i) => (k ? target[i] : null)).filter((v): v is number => typeof v === 'number');
        if (name === 'SUMIFS') return vals.reduce((x, y) => x + y, 0);
        if (name === 'AVERAGEIFS') return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : ERR.div0();
        if (!vals.length) return 0;
        return name === 'MAXIFS' ? Math.max(...vals) : Math.min(...vals);
      }
      case 'XLOOKUP': {
        const a = A();
        const [lookup, lookupArr, returnArr, ifNotFound] = a;
        const la = flat(lookupArr);
        const ra = flat(returnArr);
        const i = la.findIndex((v) => compare(v, lookup) === 0);
        if (i === -1) return ifNotFound !== undefined ? ifNotFound : ERR.na();
        return ra[i] ?? null;
      }
      case 'VLOOKUP': {
        const a = A();
        const [lookup, table, colIdx, approx] = a;
        const values = flat(table);
        const col = num(colIdx);
        if (col instanceof ExcelError) return col;
        // Table is a flattened range: infer width from the range node if possible.
        const rangeNode = argNodes[1];
        let width = 1;
        if (rangeNode.k === 'range') {
          const [s, e] = rangeNode.v.split(':').map(parseRef);
          if (s && e) width = Math.abs(e.col - s.col) + 1;
        }
        const rows = values.length / width;
        for (let r = 0; r < rows; r++) {
          const key = values[r * width];
          const exact = compare(key, lookup) === 0;
          if (exact || (approx === true && compare(key, lookup) > 0 && r > 0)) {
            const target = exact ? r : r - 1;
            return values[target * width + (col - 1)] ?? null;
          }
        }
        return approx === true && rows > 0 ? values[(rows - 1) * width + (col - 1)] ?? null : ERR.na();
      }
      case 'INDEX': {
        const a = A();
        const values = flat(a[0]);
        const rangeNode = argNodes[0];
        let width = 1;
        if (rangeNode.k === 'range') {
          const [s, e] = rangeNode.v.split(':').map(parseRef);
          if (s && e) width = Math.abs(e.col - s.col) + 1;
        }
        const r = num(a[1] ?? 1);
        const c = num(a[2] ?? 1);
        if (r instanceof ExcelError) return r;
        if (c instanceof ExcelError) return c;
        const idx = (r - 1) * width + (c - 1);
        if (idx < 0 || idx >= values.length) return ERR.ref();
        return values[idx];
      }
      case 'MATCH': {
        const a = A();
        const target = a[0];
        const arr = flat(a[1]);
        const type = a[2] === undefined ? 1 : num(a[2]);
        if (type instanceof ExcelError) return type;
        if (type === 0) {
          const i = arr.findIndex((v) => matchCriteria(v, target));
          return i === -1 ? ERR.na() : i + 1;
        }
        let best = -1;
        arr.forEach((v, i) => {
          const c = compare(v, target);
          if (type === 1 && c <= 0) best = i;
          if (type === -1 && c >= 0) best = i;
        });
        return best === -1 ? ERR.na() : best + 1;
      }
      case 'LEFT':
      case 'RIGHT': {
        const a = A();
        const s = text(a[0]);
        const n2 = a[1] === undefined ? 1 : num(a[1]);
        if (n2 instanceof ExcelError) return n2;
        return name === 'LEFT' ? s.slice(0, n2) : s.slice(Math.max(0, s.length - n2));
      }
      case 'MID': {
        const a = A();
        const s = text(a[0]);
        const start = num(a[1]);
        const len = num(a[2]);
        if (start instanceof ExcelError) return start;
        if (len instanceof ExcelError) return len;
        return s.slice(start - 1, start - 1 + len);
      }
      case 'LEN':
        return text(A()[0]).length;
      case 'TRIM':
        return text(A()[0]).trim().replace(/\s+/g, ' ');
      case 'UPPER':
        return text(A()[0]).toUpperCase();
      case 'LOWER':
        return text(A()[0]).toLowerCase();
      case 'PROPER':
        return text(A()[0])
          .toLowerCase()
          .replace(/\b\w/g, (m) => m.toUpperCase());
      case 'CONCAT':
      case 'CONCATENATE':
        return flat(A()).map(text).join('');
      case 'TEXTJOIN': {
        const a = A();
        const sep = text(a[0]);
        const ignoreEmpty = a[1] === true || a[1] === 1;
        const parts = flat(a.slice(2)).map(text).filter((s) => !ignoreEmpty || s !== '');
        return parts.join(sep);
      }
      case 'SUBSTITUTE': {
        const a = A();
        return text(a[0]).split(text(a[1])).join(text(a[2]));
      }
      case 'FIND':
      case 'SEARCH': {
        const a = A();
        const needle = text(a[0]);
        const hay = text(a[1]);
        const i = name === 'FIND' ? hay.indexOf(needle) : hay.toLowerCase().indexOf(needle.toLowerCase());
        return i === -1 ? ERR.value() : i + 1;
      }
      case 'EXACT': {
        const a = A();
        return text(a[0]) === text(a[1]);
      }
      case 'VALUE': {
        const v = num(A()[0]);
        return v;
      }
      case 'TEXT': {
        const a = A();
        const v = num(a[0]);
        if (v instanceof ExcelError) return v;
        const f = text(a[1]);
        if (/^0\.0+$/.test(f)) return v.toFixed(f.split('.')[1].length);
        if (f === '0') return String(Math.round(v));
        if (/y{4}-m{2}-d{2}/i.test(f)) {
          const d = serialToDate(v);
          return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        }
        if (f.includes('%')) return `${(v * 100).toFixed((f.split('.')[1]?.length ?? 1) - 1)}%`;
        return String(v);
      }
      case 'DATE': {
        const [y, m, d] = A().map(num);
        if (y instanceof ExcelError || m instanceof ExcelError || d instanceof ExcelError) return ERR.value();
        return dateToSerial(y, m, d);
      }
      case 'DATEVALUE': {
        const s = parseDateString(text(A()[0]));
        return s === null ? ERR.value() : s;
      }
      case 'YEAR':
      case 'MONTH':
      case 'DAY':
      case 'WEEKDAY': {
        const v = num(A()[0]);
        if (v instanceof ExcelError) return v;
        const d = serialToDate(v);
        if (name === 'YEAR') return d.getUTCFullYear();
        if (name === 'MONTH') return d.getUTCMonth() + 1;
        if (name === 'DAY') return d.getUTCDate();
        return d.getUTCDay() + 1;
      }
      case 'EDATE':
      case 'EOMONTH': {
        const a = A();
        const v = num(a[0]);
        const months = num(a[1] ?? 0);
        if (v instanceof ExcelError) return v;
        if (months instanceof ExcelError) return months;
        const d = serialToDate(v);
        const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months + (name === 'EOMONTH' ? 1 : 0), name === 'EOMONTH' ? 0 : d.getUTCDate()));
        return dateToSerial(target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate());
      }
      case 'DATEDIF': {
        const a = A();
        const s = num(a[0]);
        const e = num(a[1]);
        const unit = text(a[2]).toUpperCase();
        if (s instanceof ExcelError) return s;
        if (e instanceof ExcelError) return e;
        const ds = serialToDate(s);
        const de = serialToDate(e);
        if (unit === 'D') return e - s;
        let months = (de.getUTCFullYear() - ds.getUTCFullYear()) * 12 + (de.getUTCMonth() - ds.getUTCMonth());
        if (de.getUTCDate() < ds.getUTCDate()) months--;
        if (unit === 'M') return months;
        if (unit === 'Y') return Math.floor(months / 12);
        return ERR.num();
      }
      default:
        return ERR.name();
    }
  }

  return ev(ast);
}

/** Formats an evaluated value for display. */
export function formatValue(v: EvalValue, format?: string): string {
  if (v === null) return '';
  if (v instanceof ExcelError) return v.code;
  if (Array.isArray(v)) return v.map((x) => formatValue(x)).join(', ');
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') {
    if (format && /y{4}-m{2}-d{2}/i.test(format)) {
      const d = serialToDate(v);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }
    if (format && /^0(\.0+)?$/.test(format)) return v.toFixed(format.includes('.') ? format.split('.')[1].length : 0);
    if (format === '0%') return `${Math.round(v * 100)}%`;
    if (format === '0.0%') return `${(v * 100).toFixed(1)}%`;
    return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12)));
  }
  return v;
}
