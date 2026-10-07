/**
 * Survival analysis: Kaplan–Meier with Greenwood variance, median survival
 * with confidence intervals (Brookmeyer–Crowley inversion), the (stratified)
 * log-rank test and Cox proportional-hazards regression with Breslow or Efron
 * handling of ties (SAS PROC PHREG defaults to Breslow; R's coxph to Efron).
 * Validated against R's survival package in survival.test.ts.
 */
import { chiSquareCdf, normalQuantile, normalCdf } from './distributions';

export interface SurvRecord {
  time: number;
  /** 1 = event, 0 = censored */
  event: 0 | 1;
  group?: string;
  strata?: string;
  covariates?: number[];
}

export type CiType = 'log-log' | 'log' | 'plain';

export interface KmStep {
  time: number;
  nRisk: number;
  nEvent: number;
  nCensor: number;
  surv: number;
  /** Greenwood variance of S(t) */
  variance: number;
  se: number;
  lower: number;
  upper: number;
}

export interface KmResult {
  steps: KmStep[];
  n: number;
  events: number;
  median: number | null;
  medianLower: number | null;
  medianUpper: number | null;
  ciType: CiType;
  /** Censoring times (for tick marks). */
  censorTimes: number[];
}

function ciBounds(s: number, v: number, z: number, type: CiType): [number, number] {
  if (s <= 0 || !Number.isFinite(v)) return [0, 0];
  if (s >= 1) return [1, 1];
  const se = Math.sqrt(v);
  if (type === 'plain') return [Math.max(0, s - z * se), Math.min(1, s + z * se)];
  if (type === 'log') {
    const k = (z * se) / s;
    return [Math.max(0, s * Math.exp(-k)), Math.min(1, s * Math.exp(k))];
  }
  // log-log (complementary log-log) — SAS PROC LIFETEST default
  const logS = Math.log(s);
  const k = (z * se) / (s * Math.abs(logS));
  return [s ** Math.exp(k), s ** Math.exp(-k)];
}

/**
 * Kaplan–Meier estimator. At tied times, events are processed before censorings
 * (a subject censored at t was at risk at t).
 */
export function kaplanMeier(records: SurvRecord[], opts: { ciType?: CiType; conf?: number } = {}): KmResult {
  const ciType = opts.ciType ?? 'log-log';
  const z = normalQuantile(1 - (1 - (opts.conf ?? 0.95)) / 2);
  const sorted = [...records].sort((a, b) => a.time - b.time);
  const times = [...new Set(sorted.map((r) => r.time))].sort((a, b) => a - b);
  let atRisk = sorted.length;
  let surv = 1;
  let greenwoodSum = 0;
  const steps: KmStep[] = [];
  const censorTimes: number[] = [];
  let idx = 0;
  for (const t of times) {
    let d = 0;
    let c = 0;
    while (idx < sorted.length && sorted[idx].time === t) {
      if (sorted[idx].event === 1) d++;
      else c++;
      idx++;
    }
    const nRisk = atRisk;
    if (d > 0) {
      surv *= 1 - d / nRisk;
      if (nRisk - d > 0) greenwoodSum += d / (nRisk * (nRisk - d));
      else greenwoodSum = Infinity;
    }
    const variance = surv > 0 ? surv * surv * greenwoodSum : 0;
    const [lower, upper] = ciBounds(surv, variance, z, ciType);
    if (c > 0) for (let i = 0; i < c; i++) censorTimes.push(t);
    steps.push({ time: t, nRisk, nEvent: d, nCensor: c, surv, variance, se: Math.sqrt(variance), lower, upper });
    atRisk -= d + c;
  }

  // Median: smallest time with S(t) <= 0.5 (R/SAS convention; if S == 0.5 exactly over an interval,
  // the midpoint convention is used by R — we follow R and SAS: average of that time and the next event time).
  const medianAt = (curve: (s: KmStep) => number): number | null => {
    const eventSteps = steps.filter((s) => s.nEvent > 0);
    for (let i = 0; i < eventSteps.length; i++) {
      const v = curve(eventSteps[i]);
      if (v < 0.5 - 1e-12) return eventSteps[i].time;
      if (Math.abs(v - 0.5) <= 1e-12) {
        const next = eventSteps[i + 1];
        return next ? (eventSteps[i].time + next.time) / 2 : eventSteps[i].time;
      }
    }
    return null;
  };
  const median = medianAt((s) => s.surv);
  // Brookmeyer–Crowley-type limits: the median CI spans the times at which 0.5 lies inside the
  // pointwise band — from the first time the LOWER band reaches 0.5 to the first time the UPPER band does.
  const medianLower = medianAt((s) => s.lower);
  const medianUpper = medianAt((s) => s.upper);

  return {
    steps,
    n: records.length,
    events: records.filter((r) => r.event === 1).length,
    median,
    medianLower,
    medianUpper,
    ciType,
    censorTimes,
  };
}

/** Survival probability at time t from a KM result (right-continuous step function). */
export function survivalAt(km: KmResult, t: number): number {
  let s = 1;
  for (const step of km.steps) {
    if (step.time > t) break;
    s = step.surv;
  }
  return s;
}

/** Number at risk just before or at t (subjects with time >= t). */
export function numberAtRisk(records: SurvRecord[], t: number): number {
  return records.filter((r) => r.time >= t).length;
}

export interface LogRankResult {
  chiSquare: number;
  df: number;
  p: number;
  observed: Record<string, number>;
  expected: Record<string, number>;
}

/** Log-rank test for k groups, optionally stratified (sums O−E and variance across strata). */
export function logRank(records: SurvRecord[]): LogRankResult {
  const groups = [...new Set(records.map((r) => r.group ?? ''))].sort();
  const k = groups.length;
  const strata = [...new Set(records.map((r) => r.strata ?? ''))];
  const O = new Array(k).fill(0);
  const E = new Array(k).fill(0);
  const V: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  for (const s of strata) {
    const recs = records.filter((r) => (r.strata ?? '') === s);
    const times = [...new Set(recs.filter((r) => r.event === 1).map((r) => r.time))].sort((a, b) => a - b);
    for (const t of times) {
      const atRisk = groups.map((g) => recs.filter((r) => (r.group ?? '') === g && r.time >= t).length);
      const deaths = groups.map((g) => recs.filter((r) => (r.group ?? '') === g && r.time === t && r.event === 1).length);
      const n = atRisk.reduce((a, b) => a + b, 0);
      const d = deaths.reduce((a, b) => a + b, 0);
      if (n === 0) continue;
      for (let i = 0; i < k; i++) {
        O[i] += deaths[i];
        E[i] += (d * atRisk[i]) / n;
        if (n > 1) {
          for (let j = 0; j < k; j++) {
            const cov = i === j ? (atRisk[i] * (n - atRisk[i]) * d * (n - d)) / (n * n * (n - 1)) : (-atRisk[i] * atRisk[j] * d * (n - d)) / (n * n * (n - 1));
            V[i][j] += cov;
          }
        }
      }
    }
  }
  // Use the first k-1 groups: chi2 = (O-E)' V^-1 (O-E)
  const m = k - 1;
  const diff = O.slice(0, m).map((o, i) => o - E[i]);
  const Vm = V.slice(0, m).map((row) => row.slice(0, m));
  const inv = invert(Vm);
  let chi = 0;
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) chi += diff[i] * inv[i][j] * diff[j];
  const observed: Record<string, number> = {};
  const expected: Record<string, number> = {};
  groups.forEach((g, i) => {
    observed[g] = O[i];
    expected[g] = E[i];
  });
  return { chiSquare: chi, df: m, p: 1 - chiSquareCdf(chi, m), observed, expected };
}

/**
 * Schoenfeld residuals for a fitted Cox model: at each event time, the observed
 * covariate value minus its risk-set weighted mean. Scaled residuals (Grambsch–
 * Therneau) are what `cox.zph` plots; a trend in time is evidence against
 * proportional hazards.
 */
export function schoenfeldResiduals(records: SurvRecord[], beta: number[], covIndex = 0): { time: number; residual: number; scaled: number }[] {
  const p = beta.length;
  const sorted = [...records].sort((a, b) => a.time - b.time);
  const eventTimes = [...new Set(sorted.filter((r) => r.event === 1).map((r) => r.time))].sort((a, b) => a - b);
  const out: { time: number; residual: number; scaled: number }[] = [];
  // Information matrix at beta for scaling
  const fit = evaluateInfo(sorted, beta);
  const cov = invert(fit.I);
  const d = eventTimes.reduce((s, t) => s + sorted.filter((r) => r.time === t && r.event === 1).length, 0);
  for (const t of eventTimes) {
    const risk = sorted.filter((r) => r.time >= t);
    const deaths = sorted.filter((r) => r.time === t && r.event === 1);
    let S0 = 0;
    const S1 = new Array(p).fill(0);
    for (const r of risk) {
      const w = Math.exp(r.covariates!.reduce((s, x, j) => s + x * beta[j], 0));
      S0 += w;
      for (let a = 0; a < p; a++) S1[a] += w * r.covariates![a];
    }
    let D0 = 0;
    const D1 = new Array(p).fill(0);
    for (const r of deaths) {
      const w = Math.exp(r.covariates!.reduce((s, x, j) => s + x * beta[j], 0));
      D0 += w;
      for (let a = 0; a < p; a++) D1[a] += w * r.covariates![a];
    }
    // Efron-averaged risk-set mean over the tied deaths (equals S1/S0 when there are no ties).
    const dk = deaths.length;
    let mean = 0;
    for (let k = 0; k < dk; k++) {
      const f = k / dk;
      mean += (S1[covIndex] - f * D1[covIndex]) / (S0 - f * D0);
    }
    mean /= dk;
    for (const ev of deaths) {
      const resid = ev.covariates![covIndex] - mean;
      const scaled = beta[covIndex] + d * cov[covIndex][covIndex] * resid;
      out.push({ time: t, residual: resid, scaled });
    }
  }
  return out;
}

function evaluateInfo(records: SurvRecord[], beta: number[]) {
  const p = beta.length;
  const I: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const eventTimes = [...new Set(records.filter((r) => r.event === 1).map((r) => r.time))];
  for (const t of eventTimes) {
    const risk = records.filter((r) => r.time >= t);
    const dCount = records.filter((r) => r.time === t && r.event === 1).length;
    let S0 = 0;
    const S1 = new Array(p).fill(0);
    const S2: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
    for (const r of risk) {
      const w = Math.exp(r.covariates!.reduce((s, x, j) => s + x * beta[j], 0));
      S0 += w;
      for (let a = 0; a < p; a++) {
        S1[a] += w * r.covariates![a];
        for (let b = 0; b < p; b++) S2[a][b] += w * r.covariates![a] * r.covariates![b];
      }
    }
    for (let a = 0; a < p; a++)
      for (let b = 0; b < p; b++) I[a][b] += dCount * (S2[a][b] / S0 - (S1[a] * S1[b]) / (S0 * S0));
  }
  return { I };
}

/* ------------------------------ Linear algebra ------------------------------ */

export function invert(a: number[][]): number[][] {
  const n = a.length;
  const m = a.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const pv = m[col][col];
    if (Math.abs(pv) < 1e-14) throw new Error('Singular matrix');
    for (let j = 0; j < 2 * n; j++) m[col][j] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r][col];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) m[r][j] -= f * m[col][j];
    }
  }
  return m.map((row) => row.slice(n));
}

/* --------------------------------- Cox PH ---------------------------------- */

export interface CoxResult {
  coef: number[];
  se: number[];
  hr: number[];
  hrLower: number[];
  hrUpper: number[];
  z: number[];
  p: number[];
  logLik: number;
  iterations: number;
  ties: 'breslow' | 'efron';
  /** Score (log-rank-like) test for all coefficients = 0. */
  scoreChiSquare: number;
}

/**
 * Cox proportional hazards via Newton–Raphson on the partial likelihood.
 * `records[i].covariates` holds the design row; `strata` gives a stratified model
 * (separate baseline hazards, common coefficients).
 */
export function coxPH(records: SurvRecord[], opts: { ties?: 'breslow' | 'efron'; conf?: number; maxIter?: number } = {}): CoxResult {
  const ties = opts.ties ?? 'efron';
  const p = records[0]?.covariates?.length ?? 0;
  const strata = [...new Set(records.map((r) => r.strata ?? ''))];
  const groups = strata.map((s) => records.filter((r) => (r.strata ?? '') === s).sort((a, b) => a.time - b.time));

  const evaluate = (beta: number[]) => {
    let ll = 0;
    const U = new Array(p).fill(0);
    const I: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
    for (const recs of groups) {
      const eta = recs.map((r) => r.covariates!.reduce((s, x, j) => s + x * beta[j], 0));
      const w = eta.map((e) => Math.exp(e));
      const times = [...new Set(recs.filter((r) => r.event === 1).map((r) => r.time))];
      for (const t of times) {
        const riskIdx: number[] = [];
        const deathIdx: number[] = [];
        recs.forEach((r, i) => {
          if (r.time >= t) riskIdx.push(i);
          if (r.time === t && r.event === 1) deathIdx.push(i);
        });
        const d = deathIdx.length;
        // Sums over the risk set
        let S0 = 0;
        const S1 = new Array(p).fill(0);
        const S2: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
        for (const i of riskIdx) {
          S0 += w[i];
          const x = recs[i].covariates!;
          for (let a = 0; a < p; a++) {
            S1[a] += w[i] * x[a];
            for (let b = 0; b < p; b++) S2[a][b] += w[i] * x[a] * x[b];
          }
        }
        // Sums over the tied deaths
        let D0 = 0;
        const D1 = new Array(p).fill(0);
        const D2: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
        const xsum = new Array(p).fill(0);
        for (const i of deathIdx) {
          D0 += w[i];
          ll += eta[i];
          const x = recs[i].covariates!;
          for (let a = 0; a < p; a++) {
            xsum[a] += x[a];
            D1[a] += w[i] * x[a];
            for (let b = 0; b < p; b++) D2[a][b] += w[i] * x[a] * x[b];
          }
        }
        for (let a = 0; a < p; a++) U[a] += xsum[a];
        for (let k = 0; k < d; k++) {
          const f = ties === 'efron' ? k / d : 0;
          const s0 = S0 - f * D0;
          const s1 = S1.map((v, a) => v - f * D1[a]);
          ll -= Math.log(s0);
          for (let a = 0; a < p; a++) {
            U[a] -= s1[a] / s0;
            for (let b = 0; b < p; b++) {
              const s2 = S2[a][b] - f * D2[a][b];
              I[a][b] += s2 / s0 - (s1[a] * s1[b]) / (s0 * s0);
            }
          }
        }
      }
    }
    return { ll, U, I };
  };

  let beta = new Array(p).fill(0);
  let { ll, U, I } = evaluate(beta);
  // Score test at beta = 0
  const Iinv0 = invert(I);
  let scoreChi = 0;
  for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) scoreChi += U[a] * Iinv0[a][b] * U[b];
  let iter = 0;
  for (; iter < (opts.maxIter ?? 50); iter++) {
    const Iinv = invert(I);
    const step = Iinv.map((row) => row.reduce((s, v, j) => s + v * U[j], 0));
    let newBeta = beta.map((b, a) => b + step[a]);
    let next = evaluate(newBeta);
    // Step halving if the likelihood decreases
    let halving = 0;
    while (next.ll < ll - 1e-10 && halving < 20) {
      newBeta = beta.map((b, a) => b + step[a] / 2 ** (halving + 1));
      next = evaluate(newBeta);
      halving++;
    }
    const converged = Math.abs(next.ll - ll) < 1e-10 * Math.max(1, Math.abs(ll));
    beta = newBeta;
    ({ ll, U, I } = next);
    if (converged) break;
  }
  const cov = invert(I);
  const se = cov.map((row, a) => Math.sqrt(row[a]));
  const zc = normalQuantile(1 - (1 - (opts.conf ?? 0.95)) / 2);
  const z = beta.map((b, a) => b / se[a]);
  return {
    coef: beta,
    se,
    hr: beta.map(Math.exp),
    hrLower: beta.map((b, a) => Math.exp(b - zc * se[a])),
    hrUpper: beta.map((b, a) => Math.exp(b + zc * se[a])),
    z,
    p: z.map((v) => 2 * (1 - normalCdf(Math.abs(v)))),
    logLik: ll,
    iterations: iter + 1,
    ties,
    scoreChiSquare: scoreChi,
  };
}
