/**
 * Linear models (OLS with diagnostics), logistic regression (IRLS) and helpers.
 * Designed for the small, interactive examples in lessons and widgets.
 */
import { invert } from './survival';
import { tCdf, tQuantile, normalCdf, normalQuantile, fCdf } from './distributions';

export interface OlsResult {
  coef: number[];
  se: number[];
  t: number[];
  p: number[];
  lower: number[];
  upper: number[];
  fitted: number[];
  residuals: number[];
  /** Leverage (diagonal of the hat matrix) */
  hat: number[];
  cooksD: number[];
  studentized: number[];
  sigma: number;
  rSquared: number;
  adjRSquared: number;
  df: number;
  fStat: number;
  fP: number;
  n: number;
  p_: number;
}

function matMul(a: number[][], b: number[][]): number[][] {
  const out = Array.from({ length: a.length }, () => new Array(b[0].length).fill(0));
  for (let i = 0; i < a.length; i++) for (let k = 0; k < b.length; k++) {
    const aik = a[i][k];
    if (aik === 0) continue;
    for (let j = 0; j < b[0].length; j++) out[i][j] += aik * b[k][j];
  }
  return out;
}

function transpose(a: number[][]): number[][] {
  return a[0].map((_, j) => a.map((row) => row[j]));
}

/** X should include the intercept column if one is wanted. */
export function ols(X: number[][], y: number[], conf = 0.95): OlsResult {
  const n = X.length;
  const p = X[0].length;
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const XtXinv = invert(XtX);
  const Xty = Xt.map((row) => row.reduce((s, v, i) => s + v * y[i], 0));
  const coef = XtXinv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0));
  const fitted = X.map((row) => row.reduce((s, v, j) => s + v * coef[j], 0));
  const residuals = y.map((v, i) => v - fitted[i]);
  const df = n - p;
  const rss = residuals.reduce((s, r) => s + r * r, 0);
  const sigma2 = rss / df;
  const sigma = Math.sqrt(sigma2);
  const se = XtXinv.map((row, j) => Math.sqrt(row[j] * sigma2));
  const t = coef.map((b, j) => b / se[j]);
  const pv = t.map((v) => 2 * (1 - tCdf(Math.abs(v), df)));
  const tc = tQuantile(1 - (1 - conf) / 2, df);
  const hat = X.map((row) => {
    let h = 0;
    for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) h += row[a] * XtXinv[a][b] * row[b];
    return h;
  });
  const cooksD = residuals.map((r, i) => ((r * r) / (p * sigma2)) * (hat[i] / (1 - hat[i]) ** 2));
  const studentized = residuals.map((r, i) => r / (sigma * Math.sqrt(1 - hat[i])));
  const ybar = y.reduce((a, b) => a + b, 0) / n;
  const tss = y.reduce((s, v) => s + (v - ybar) ** 2, 0);
  const hasIntercept = X.every((row) => row[0] === 1);
  const rSquared = hasIntercept ? 1 - rss / tss : 1 - rss / y.reduce((s, v) => s + v * v, 0);
  const dfModel = hasIntercept ? p - 1 : p;
  const adjRSquared = 1 - ((1 - rSquared) * (n - (hasIntercept ? 1 : 0))) / df;
  const fStat = dfModel > 0 ? ((tss - rss) / dfModel) / sigma2 : NaN;
  return {
    coef,
    se,
    t,
    p: pv,
    lower: coef.map((b, j) => b - tc * se[j]),
    upper: coef.map((b, j) => b + tc * se[j]),
    fitted,
    residuals,
    hat,
    cooksD,
    studentized,
    sigma,
    rSquared,
    adjRSquared,
    df,
    fStat,
    fP: dfModel > 0 ? 1 - fCdf(fStat, dfModel, df) : NaN,
    n,
    p_: p,
  };
}

/** Simple linear regression convenience wrapper. */
export function simpleRegression(x: number[], y: number[]) {
  return ols(
    x.map((v) => [1, v]),
    y,
  );
}

export interface LogisticResult {
  coef: number[];
  se: number[];
  z: number[];
  p: number[];
  or: number[];
  orLower: number[];
  orUpper: number[];
  fitted: number[];
  deviance: number;
  nullDeviance: number;
  iterations: number;
  converged: boolean;
}

/** Logistic regression by iteratively reweighted least squares (Wald CIs, like SAS/R defaults for ORs). */
export function logistic(X: number[][], y: number[], conf = 0.95): LogisticResult {
  const n = X.length;
  const p = X[0].length;
  let beta = new Array(p).fill(0);
  let converged = false;
  let iter = 0;
  let mu = new Array(n).fill(0.5);
  for (; iter < 60; iter++) {
    const eta = X.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0));
    mu = eta.map((e) => 1 / (1 + Math.exp(-e)));
    const W = mu.map((m) => Math.max(m * (1 - m), 1e-12));
    const z = eta.map((e, i) => e + (y[i] - mu[i]) / W[i]);
    const XtWX = Array.from({ length: p }, () => new Array(p).fill(0));
    const XtWz = new Array(p).fill(0);
    for (let i = 0; i < n; i++) {
      for (let a = 0; a < p; a++) {
        XtWz[a] += X[i][a] * W[i] * z[i];
        for (let b = 0; b < p; b++) XtWX[a][b] += X[i][a] * W[i] * X[i][b];
      }
    }
    const next = invert(XtWX).map((row) => row.reduce((s, v, j) => s + v * XtWz[j], 0));
    const delta = Math.max(...next.map((b, j) => Math.abs(b - beta[j])));
    beta = next;
    if (delta < 1e-10) {
      converged = true;
      break;
    }
  }
  const eta = X.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0));
  mu = eta.map((e) => 1 / (1 + Math.exp(-e)));
  const XtWX = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < n; i++) {
    const w = mu[i] * (1 - mu[i]);
    for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) XtWX[a][b] += X[i][a] * w * X[i][b];
  }
  const cov = invert(XtWX);
  const se = cov.map((row, j) => Math.sqrt(row[j]));
  const z = beta.map((b, j) => b / se[j]);
  const zc = normalQuantile(1 - (1 - conf) / 2);
  const ll = (m: number[]) => y.reduce((s, v, i) => s + (v === 1 ? Math.log(Math.max(m[i], 1e-300)) : Math.log(Math.max(1 - m[i], 1e-300))), 0);
  const ybar = y.reduce((a, b) => a + b, 0) / n;
  return {
    coef: beta,
    se,
    z,
    p: z.map((v) => 2 * (1 - normalCdf(Math.abs(v)))),
    or: beta.map(Math.exp),
    orLower: beta.map((b, j) => Math.exp(b - zc * se[j])),
    orUpper: beta.map((b, j) => Math.exp(b + zc * se[j])),
    fitted: mu,
    deviance: -2 * ll(mu),
    nullDeviance: -2 * ll(new Array(n).fill(ybar)),
    iterations: iter + 1,
    converged,
  };
}

/** Pearson correlation. */
export function correlation(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

export function correlationMatrix(cols: number[][]): number[][] {
  return cols.map((a) => cols.map((b) => correlation(a, b)));
}

/** Variance inflation factors for predictor columns (no intercept column). */
export function vif(cols: number[][]): number[] {
  return cols.map((target, j) => {
    const others = cols.filter((_, k) => k !== j);
    const X = target.map((_, i) => [1, ...others.map((c) => c[i])]);
    const r2 = ols(X, target).rSquared;
    return 1 / (1 - r2);
  });
}
