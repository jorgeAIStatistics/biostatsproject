/**
 * Descriptive statistics with explicit quantile definitions, because SAS and R
 * disagree by default: SAS PROC MEANS/UNIVARIATE use QNTLDEF/PCTLDEF=5, R's
 * quantile() uses type 7. Clinical tables built in different languages can
 * therefore show different Q1/Q3 for the same data.
 */
export type QuantileDef = 'sas5' | 'r7' | 'r6';

export function clean(values: (number | null | undefined)[]): number[] {
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

export function mean(xs: number[]): number {
  if (!xs.length) return NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Sample variance (n − 1 denominator). */
export function variance(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return s / (n - 1);
}

export function sd(xs: number[]): number {
  return Math.sqrt(variance(xs));
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

/**
 * Quantile of already-sorted data.
 *  - 'sas5': SAS default (PCTLDEF=5) — empirical distribution with averaging at discontinuities.
 *  - 'r7':   R default (type 7) — linear interpolation between order statistics, h = (n−1)p + 1.
 *  - 'r6':   type 6 (Minitab/SPSS), h = (n+1)p.
 */
export function quantileSorted(sorted: number[], p: number, def: QuantileDef = 'sas5'): number {
  const n = sorted.length;
  if (!n) return NaN;
  if (def === 'sas5') {
    const np = n * p;
    const j = Math.floor(np);
    const g = np - j;
    if (g === 0) {
      if (j === 0) return sorted[0];
      if (j >= n) return sorted[n - 1];
      return (sorted[j - 1] + sorted[j]) / 2;
    }
    return sorted[Math.min(n - 1, j)];
  }
  const h = def === 'r7' ? (n - 1) * p + 1 : (n + 1) * p;
  const lo = Math.floor(h);
  const frac = h - lo;
  const a = sorted[Math.min(n - 1, Math.max(0, lo - 1))];
  const b = sorted[Math.min(n - 1, Math.max(0, lo))];
  if (h <= 1) return sorted[0];
  if (h >= n) return sorted[n - 1];
  return a + frac * (b - a);
}

export function quantile(xs: number[], p: number, def: QuantileDef = 'sas5'): number {
  return quantileSorted([...xs].sort((a, b) => a - b), p, def);
}

export function median(xs: number[]): number {
  return quantile(xs, 0.5, 'r7');
}

export interface Summary {
  n: number;
  nmiss: number;
  mean: number;
  sd: number;
  se: number;
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
}

export function summarize(values: (number | null | undefined)[], def: QuantileDef = 'sas5'): Summary {
  const xs = clean(values);
  const sorted = [...xs].sort((a, b) => a - b);
  const n = xs.length;
  const s = sd(xs);
  return {
    n,
    nmiss: values.length - n,
    mean: mean(xs),
    sd: s,
    se: n > 1 ? s / Math.sqrt(n) : NaN,
    median: quantileSorted(sorted, 0.5, def),
    q1: quantileSorted(sorted, 0.25, def),
    q3: quantileSorted(sorted, 0.75, def),
    min: n ? sorted[0] : NaN,
    max: n ? sorted[n - 1] : NaN,
  };
}

/** SAS-style ROUND (half away from zero) vs R/Python/IEEE round-half-to-even. */
export function roundHalfAway(x: number, digits = 0): number {
  const f = 10 ** digits;
  const y = Math.abs(x) * f;
  // Guard against binary representation error (e.g. 2.675 → 2.67499999…)
  const r = Math.floor(y + 0.5 + 1e-9);
  return (Math.sign(x) * r) / f;
}

export function roundHalfEven(x: number, digits = 0): number {
  const f = 10 ** digits;
  const y = x * f;
  const r = Math.round(y);
  const diff = Math.abs(y - Math.trunc(y));
  if (Math.abs(diff - 0.5) < 1e-9) {
    const t = Math.trunc(y);
    return (t % 2 === 0 ? t : t + Math.sign(y)) / f;
  }
  return r / f;
}

/** Formats a number with fixed decimals using SAS-style rounding (as most clinical tables do). */
export function fmtFixed(x: number, digits: number): string {
  if (!Number.isFinite(x)) return '';
  const r = roundHalfAway(x, digits);
  return r.toFixed(digits);
}

export function pct(n: number, d: number, digits = 1): string {
  if (!d) return '';
  return fmtFixed((100 * n) / d, digits);
}
