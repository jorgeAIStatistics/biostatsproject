/** Classical tests and interval estimates used in lessons, widgets and TLFs. */
import { mean, variance } from './descriptive';
import { tCdf, tQuantile, chiSquareCdf, normalQuantile, normalCdf, betaQuantile, logGamma } from './distributions';

export interface TTestResult {
  t: number;
  df: number;
  p: number;
  diff: number;
  lower: number;
  upper: number;
  se: number;
}

/** Two-sample t test: Welch (default, like R) or pooled (equal variances). */
export function tTest2(x: number[], y: number[], opts: { pooled?: boolean; conf?: number } = {}): TTestResult {
  const nx = x.length;
  const ny = y.length;
  const vx = variance(x);
  const vy = variance(y);
  const diff = mean(x) - mean(y);
  let se: number;
  let df: number;
  if (opts.pooled) {
    const sp2 = ((nx - 1) * vx + (ny - 1) * vy) / (nx + ny - 2);
    se = Math.sqrt(sp2 * (1 / nx + 1 / ny));
    df = nx + ny - 2;
  } else {
    se = Math.sqrt(vx / nx + vy / ny);
    df = (vx / nx + vy / ny) ** 2 / ((vx / nx) ** 2 / (nx - 1) + (vy / ny) ** 2 / (ny - 1));
  }
  const t = diff / se;
  const tc = tQuantile(1 - (1 - (opts.conf ?? 0.95)) / 2, df);
  return { t, df, p: 2 * (1 - tCdf(Math.abs(t), df)), diff, lower: diff - tc * se, upper: diff + tc * se, se };
}

export function tTest1(x: number[], mu0 = 0, conf = 0.95): TTestResult {
  const n = x.length;
  const se = Math.sqrt(variance(x) / n);
  const diff = mean(x) - mu0;
  const t = diff / se;
  const df = n - 1;
  const tc = tQuantile(1 - (1 - conf) / 2, df);
  return { t, df, p: 2 * (1 - tCdf(Math.abs(t), df)), diff, lower: diff - tc * se, upper: diff + tc * se, se };
}

export interface ChiSquareResult {
  chiSquare: number;
  df: number;
  p: number;
  expected: number[][];
}

/** Pearson chi-square test of independence (no continuity correction, like SAS PROC FREQ CHISQ). */
export function chiSquareTest(table: number[][]): ChiSquareResult {
  const rows = table.map((r) => r.reduce((a, b) => a + b, 0));
  const cols = table[0].map((_, j) => table.reduce((s, r) => s + r[j], 0));
  const total = rows.reduce((a, b) => a + b, 0);
  const expected = table.map((r, i) => r.map((_, j) => (rows[i] * cols[j]) / total));
  let chi = 0;
  table.forEach((r, i) => r.forEach((o, j) => (chi += (o - expected[i][j]) ** 2 / expected[i][j])));
  const df = (table.length - 1) * (table[0].length - 1);
  return { chiSquare: chi, df, p: 1 - chiSquareCdf(chi, df), expected };
}

function logChoose(n: number, k: number) {
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

/** Two-sided Fisher exact test for a 2×2 table [[a, b], [c, d]] (sum of probabilities ≤ observed). */
export function fisherExact(t: [[number, number], [number, number]]): { p: number; oddsRatio: number } {
  const [[a, b], [c, d]] = t;
  const r1 = a + b;
  const r2 = c + d;
  const c1 = a + c;
  const n = r1 + r2;
  const logDen = logChoose(n, c1);
  const prob = (x: number) => Math.exp(logChoose(r1, x) + logChoose(r2, c1 - x) - logDen);
  const pObs = prob(a);
  let p = 0;
  const lo = Math.max(0, c1 - r2);
  const hi = Math.min(r1, c1);
  for (let x = lo; x <= hi; x++) {
    const px = prob(x);
    if (px <= pObs * (1 + 1e-7)) p += px;
  }
  return { p: Math.min(1, p), oddsRatio: (a * d) / (b * c) };
}

export interface ProportionCI {
  estimate: number;
  lower: number;
  upper: number;
  method: string;
}

/** Clopper–Pearson exact interval (SAS PROC FREQ BINOMIAL "Exact"). */
export function clopperPearson(x: number, n: number, conf = 0.95): ProportionCI {
  const a = (1 - conf) / 2;
  return {
    estimate: n ? x / n : NaN,
    lower: x === 0 ? 0 : betaQuantile(a, x, n - x + 1),
    upper: x === n ? 1 : betaQuantile(1 - a, x + 1, n - x),
    method: 'Clopper–Pearson (exact)',
  };
}

export function waldCI(x: number, n: number, conf = 0.95): ProportionCI {
  const p = x / n;
  const z = normalQuantile(1 - (1 - conf) / 2);
  const se = Math.sqrt((p * (1 - p)) / n);
  return { estimate: p, lower: Math.max(0, p - z * se), upper: Math.min(1, p + z * se), method: 'Wald' };
}

export function wilsonCI(x: number, n: number, conf = 0.95): ProportionCI {
  const p = x / n;
  const z = normalQuantile(1 - (1 - conf) / 2);
  const den = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return { estimate: p, lower: Math.max(0, center - half), upper: Math.min(1, center + half), method: 'Wilson' };
}

/** Difference in proportions with Wald CI. */
export function diffProportions(x1: number, n1: number, x2: number, n2: number, conf = 0.95) {
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const se = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  const z = normalQuantile(1 - (1 - conf) / 2);
  const d = p1 - p2;
  return { diff: d, lower: d - z * se, upper: d + z * se, se, p: 2 * (1 - normalCdf(Math.abs(d / se))) };
}

/* ------------------------------ Power ------------------------------ */

/** Sample size per group for comparing two means (normal approximation). */
export function nPerGroupMeans(delta: number, sd: number, alpha = 0.05, power = 0.8): number {
  const za = normalQuantile(1 - alpha / 2);
  const zb = normalQuantile(power);
  return (2 * (za + zb) ** 2 * sd * sd) / (delta * delta);
}

export function powerMeans(delta: number, sd: number, nPerGroup: number, alpha = 0.05): number {
  const za = normalQuantile(1 - alpha / 2);
  const ncp = Math.abs(delta) / (sd * Math.sqrt(2 / nPerGroup));
  return normalCdf(ncp - za) + normalCdf(-ncp - za);
}

export function nPerGroupProportions(p1: number, p2: number, alpha = 0.05, power = 0.8): number {
  const za = normalQuantile(1 - alpha / 2);
  const zb = normalQuantile(power);
  const pbar = (p1 + p2) / 2;
  const num = (za * Math.sqrt(2 * pbar * (1 - pbar)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2;
  return num / (p1 - p2) ** 2;
}

/** Schoenfeld: events needed for a two-arm log-rank test with allocation ratio r (proportion in arm 1 = r). */
export function schoenfeldEvents(hr: number, alpha = 0.05, power = 0.8, alloc = 0.5): number {
  const za = normalQuantile(1 - alpha / 2);
  const zb = normalQuantile(power);
  return (za + zb) ** 2 / (alloc * (1 - alloc) * Math.log(hr) ** 2);
}
