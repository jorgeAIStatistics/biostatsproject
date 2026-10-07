/**
 * Principal component analysis via the symmetric eigen-decomposition (cyclic
 * Jacobi rotations) of the correlation or covariance matrix. Signs are made
 * deterministic (largest absolute loading positive) — PCA itself defines
 * components only up to sign.
 */
export interface PcaResult {
  /** Eigenvalues (variances of the components), descending. */
  eigenvalues: number[];
  /** Proportion of total variance explained by each component. */
  explained: number[];
  cumulative: number[];
  /** loadings[k][j]: weight of variable j in component k (unit-length eigenvectors). */
  loadings: number[][];
  /** scores[i][k]: coordinate of observation i on component k. */
  scores: number[][];
  means: number[];
  sds: number[];
  scaled: boolean;
}

export function jacobiEigen(matrix: number[][], maxSweeps = 100): { values: number[]; vectors: number[][] } {
  const n = matrix.length;
  const a = matrix.map((r) => [...r]);
  const v: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] ** 2;
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const values = a.map((row, i) => row[i]);
  const order = values.map((_, i) => i).sort((x, y) => values[y] - values[x]);
  return {
    values: order.map((i) => values[i]),
    vectors: order.map((i) => v.map((row) => row[i])),
  };
}

/** data[i][j]: observation i, variable j. scale=true → correlation-matrix PCA (standardized variables). */
export function pca(data: number[][], scale = true): PcaResult {
  const n = data.length;
  const p = data[0].length;
  const means = Array.from({ length: p }, (_, j) => data.reduce((s, r) => s + r[j], 0) / n);
  const sds = Array.from({ length: p }, (_, j) => Math.sqrt(data.reduce((s, r) => s + (r[j] - means[j]) ** 2, 0) / (n - 1)));
  const Z = data.map((r) => r.map((v, j) => (v - means[j]) / (scale ? sds[j] || 1 : 1)));
  const C = Array.from({ length: p }, (_, a) =>
    Array.from({ length: p }, (_, b) => Z.reduce((s, r) => s + r[a] * r[b], 0) / (n - 1)),
  );
  const { values, vectors } = jacobiEigen(C);
  const loadings = vectors.map((vec) => {
    let maxIdx = 0;
    for (let j = 1; j < vec.length; j++) if (Math.abs(vec[j]) > Math.abs(vec[maxIdx])) maxIdx = j;
    return vec[maxIdx] < 0 ? vec.map((x) => -x) : vec;
  });
  const total = values.reduce((a, b) => a + Math.max(0, b), 0);
  const explained = values.map((v) => Math.max(0, v) / total);
  const cumulative = explained.map((_, i) => explained.slice(0, i + 1).reduce((a, b) => a + b, 0));
  const scores = Z.map((r) => loadings.map((vec) => vec.reduce((s, w, j) => s + w * r[j], 0)));
  return { eigenvalues: values, explained, cumulative, loadings, scores, means, sds, scaled: scale };
}
