/**
 * Seeded pseudo-random numbers for the CBX417-301 generator.
 *
 * sfc32 (Small Fast Counter, 32-bit) seeded through splitmix32. Every consumer
 * gets its own named stream (`stream(seed, "ae/1012-0007")`), so changing one
 * part of the generator never shifts the random numbers used elsewhere.
 * Only integer arithmetic and IEEE-754 double operations are used, so the same
 * seed gives byte-identical output on every run.
 */

/** FNV-1a 32-bit hash of a string label. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    let s = seed >>> 0;
    const splitmix = () => {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = splitmix();
    this.b = splitmix();
    this.c = splitmix();
    this.d = splitmix();
    for (let i = 0; i < 12; i++) this.u32();
  }

  /** sfc32 step: uniform unsigned 32-bit integer. */
  u32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform on [0, 1). */
  next(): number {
    return this.u32() / 4294967296;
  }

  /** Uniform on [a, b). */
  unif(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  /** Integer uniform on [a, b] inclusive. */
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }

  bool(p: number): boolean {
    return this.next() < p;
  }

  /** Standard normal (Box-Muller, one draw per call). */
  normal(): number {
    let u = this.next();
    while (u <= 1e-12) u = this.next();
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  norm(mean: number, sd: number): number {
    return mean + sd * this.normal();
  }

  /** Normal truncated to [lo, hi] by rejection (falls back to clamping). */
  truncNorm(mean: number, sd: number, lo: number, hi: number): number {
    for (let i = 0; i < 50; i++) {
      const x = this.norm(mean, sd);
      if (x >= lo && x <= hi) return x;
    }
    return Math.min(hi, Math.max(lo, mean));
  }

  /** Log-normal parameterised by its median and the SD of log(X). */
  lognormal(median: number, sdlog: number): number {
    return median * Math.exp(sdlog * this.normal());
  }

  exp(rate: number): number {
    let u = this.next();
    while (u <= 1e-12) u = this.next();
    return -Math.log(u) / rate;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Weighted choice; weights need not sum to 1. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    let total = 0;
    for (const w of weights) total += w;
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  /** k distinct elements, in random order. */
  sample<T>(arr: readonly T[], k: number): T[] {
    return this.shuffle([...arr]).slice(0, k);
  }
}

/** A named, independent stream derived from the master seed. */
export function stream(seed: number, label: string): Rng {
  return new Rng((Math.imul(seed >>> 0, 0x9e3779b1) ^ hashString(label)) >>> 0);
}

/** Standard normal CDF (Abramowitz-Stegun 26.2.17, |error| < 7.5e-8). */
export function pnorm(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1 - p : p;
}

/** Inverse standard normal CDF (Acklam's rational approximation). */
export function qnorm(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  const q = Math.min(1 - 1e-12, Math.max(1e-12, p));
  if (q < pl) {
    const r = Math.sqrt(-2 * Math.log(q));
    return (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
  }
  if (q > 1 - pl) {
    const r = Math.sqrt(-2 * Math.log(1 - q));
    return -(((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
  }
  const r = q - 0.5;
  const s = r * r;
  return ((((((a[0] * s + a[1]) * s + a[2]) * s + a[3]) * s + a[4]) * s + a[5]) * r) / (((((b[0] * s + b[1]) * s + b[2]) * s + b[3]) * s + b[4]) * s + 1);
}
