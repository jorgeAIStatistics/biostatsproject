/**
 * HBX-14 drug substance — synthetic biologics manufacturing process data
 * (fictional site: Helix Biologics, Building 4).
 *
 * Deterministic generator: the same SEED produces byte-identical files. Node built-ins only.
 *
 *   npx tsx scripts/data/manufacturing/generate.ts
 *
 * Writes to data/manufacturing/:
 *   process/batches.csv             one record per batch (240)
 *   process/sensor-timeseries.csv   one record per batch per 6-hour reading (13,680)
 *   process/spectra.csv             one record per batch, NIR absorbance at 61 wavelengths
 *   manifest.json                   validated by DatasetManifestSchema (src/content/schema.ts)
 *   README.md                       process description, derivation rules, simplifications
 *   manufacturing.sqlite            tables batches, sensors, spectra (sqlite3 CLI when available)
 *
 * Everything is fictional: no real facility, product, supplier or process.
 *
 * ------------------------------------------------------------------------------------------------
 * Simulation model (the "truth" behind the data) — README.md carries the learner-facing version.
 *
 * Each batch i draws four independent latent factors, and every observable is a function of them.
 * This is what makes PCA meaningful here: the 20-odd measured columns have only ~4 real dimensions.
 *
 *   g_i ~ N(0,1)   GROWTH                   — drives peak VCD, glucose demand, osmolality
 *   c_i ~ N(0,1)   CONTROL stability        — drives how tightly temperature, pH and DO hold setpoint
 *   L_i ~ N(0,1)   MEDIA LOT quality        — shared by every batch made from the same media lot
 *   m_i ~ N(0,1)   METABOLIC shift          — lactate production and reuptake, independent of growth
 *
 * m_i exists so that LACTATE_PEAK is not a near-duplicate of VCD_PEAK. Without it the two correlate
 * above 0.99, which makes the multicollinearity exercise a formality rather than a judgement call.
 *
 * Sensor channels are generated first, as continuous-time AR(1) deviations around a setpoint profile
 * whose noise SD depends on c_i. The batch summary columns (TEMP_MEAN, VCD_PEAK, LACTATE_PEAK …) are
 * then COMPUTED FROM THE SERIES, not drawn separately — so batches.csv and sensor-timeseries.csv
 * agree exactly, and a learner who recomputes a summary gets the published number back.
 *
 * Quality attributes are batch-level draws from the latents:
 *
 *   TITER_G_L   = 3.20 + 0.46 g + 0.34 c + 0.40 L + supplier + line + drift + N(0, 0.17^2)
 *   PURITY_PCT  = 96.80 + 0.85 c - 0.55 max(0, g - 0.5)                     + N(0, 0.35^2)
 *   AGGREG_PCT  =  1.60 - 0.50 c + 0.40 max(0, g)                           + N(0, 0.25^2)
 *   POTENCY_PCT =  100  + 3.10 c - 2.00 max(0, g - 0.8) + 2.20 L
 *                       + supplierPot + linePot + drift                     + N(0, 2.10^2)
 *
 * Note the deliberate NON-LINEARITY: growth only hurts potency once g exceeds 0.8. A linear model
 * fits the data acceptably and misses the mechanism, which is the point of the diagnostics step.
 *
 * The drift term is a slow decline on LINE-B only, 0.9 potency points per year from 2024-07 onward
 * (a fouling heat exchanger that was never investigated). It is visible in a control chart and
 * invisible in a pooled histogram.
 *
 * TWO GENUINE PROCESS EXCURSIONS are planted for the "explore" step of the capstone. Both are
 * attached to batches and lots CHOSEN FROM THE GENERATED SCHEDULE, never to a name guessed in
 * advance — so they are guaranteed to exist and to have the stated size:
 *   - A LINE-B temperature controller fault: the first 4 LINE-B batches from FAULT_FROM get
 *     c_i ~ N(-2.9, 0.25), so the temperature deviation SD multiplies and potency falls with it.
 *     A real signal, not an outlier to delete.
 *   - A bad media lot: the first Northvale lot after 2024-05 covering at least 3 batches gets
 *     L_i = -2.2 — low titer and low potency across all three lines at once, which is how a material
 *     problem announces itself differently from an equipment problem.
 *
 * THE LEAKAGE TRAP (the capstone's central lesson). Potency is a BATCH-level attribute. The tidy table
 * the ingestion step produces joins the batch record onto the 57 sensor rows per batch, so every row
 * carries batch-CONSTANT columns — TITER_G_L takes 234 distinct values across 240 batches, OSMOLALITY
 * 84. Those columns are batch identifiers in all but name.
 *
 * A row-level random split then puts rows from the same batch in both training and test, and a tree
 * simply looks up the batch and recalls its potency. Measured with rpart on the joined table:
 *
 *   row-level 5-fold CV     RMSE 0.371   R^2 0.994     <- the lie
 *   batch-grouped 5-fold CV RMSE 3.787   R^2 0.404     <- the truth
 *
 * A factor of 10.2 in RMSE, from one choice about how to split. Nothing about the model changed.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..', '..');
const OUT = join(ROOT, 'data', 'manufacturing');

const SEED = 71;
const N_BATCH = 240;
const FIRST_BATCH = '2023-01-09';
/** Culture duration in hours (14 days) and the sensor sampling interval. */
const DURATION_H = 336;
const SAMPLE_H = 6;
/** 57 readings per batch: t = 0, 6, 12, …, 336. */
const N_READ = DURATION_H / SAMPLE_H + 1;

/* ------------------------------------------------------------------ */
/* Seeded PRNG (splitmix32 seeding + sfc32) — same as the other studies */
/* ------------------------------------------------------------------ */

function splitmix32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return t >>> 0;
  };
}

class Rng {
  private s: [number, number, number, number];
  constructor(seed: number) {
    const sm = splitmix32(seed);
    this.s = [sm(), sm(), sm(), sm()];
    for (let i = 0; i < 20; i++) this.next();
  }
  next(): number {
    let [a, b, c, d] = this.s;
    const t0 = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const t = (t0 + d) | 0;
    c = (c + t) | 0;
    this.s = [a, b, c, d];
    return (t >>> 0) / 4294967296;
  }
  normal(mean = 0, sd = 1): number {
    const u1 = 1 - this.next();
    const u2 = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)];
  }
}

// Independent streams, so tuning one part of the simulation does not reshuffle the others.
const rngBatch = new Rng(SEED);
const rngSensor = new Rng(SEED + 101);
const rngQuality = new Rng(SEED + 202);
const rngSpectra = new Rng(SEED + 303);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const DAY_MS = 86400000;

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(iso + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10);
}
/** ISO 8601 datetime at whole hours, e.g. "2023-01-09T06:00". */
function addHours(isoDate: string, h: number): string {
  return new Date(Date.parse(isoDate + 'T00:00:00Z') + h * 3600000).toISOString().slice(0, 16);
}
function yearsSince(iso: string, from: string): number {
  return (Date.parse(iso + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / (365.25 * DAY_MS);
}
function round(x: number, dec: number): number {
  const f = 10 ** dec;
  return Math.round(x * f + Number.EPSILON * Math.sign(x) * f) / f;
}
function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}
function sd(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

/* ------------------------------------------------------------------ */
/* Fixed process constants                                             */
/* ------------------------------------------------------------------ */

const LINES = ['LINE-A', 'LINE-B', 'LINE-C'] as const;
type Line = (typeof LINES)[number];

/** Titer and potency offsets by line (LINE-C is the newest skid and runs slightly better). */
const LINE_TITER: Record<Line, number> = { 'LINE-A': 0.0, 'LINE-B': -0.06, 'LINE-C': 0.09 };
const LINE_POTENCY: Record<Line, number> = { 'LINE-A': 0.0, 'LINE-B': -0.5, 'LINE-C': 0.7 };

const SUPPLIERS = ['Northvale Media', 'Calderon Biosciences'] as const;
type Supplier = (typeof SUPPLIERS)[number];
const SUPPLIER_CODE: Record<Supplier, string> = { 'Northvale Media': 'NV', 'Calderon Biosciences': 'CB' };
const SUPPLIER_TITER: Record<Supplier, number> = { 'Northvale Media': 0.0, 'Calderon Biosciences': 0.13 };
const SUPPLIER_POTENCY: Record<Supplier, number> = { 'Northvale Media': 0.0, 'Calderon Biosciences': 0.9 };

/** Release specification for HBX-14 drug substance (fictional). */
const SPEC = { potencyLo: 85, potencyHi: 115, purityLo: 94.0, aggregateHi: 3.5 };

/** The planted temperature-controller fault: 4 consecutive LINE-B batches from this date. */
const FAULT_LINE: Line = 'LINE-B';
const FAULT_FROM = '2024-09-01';
const FAULT_N = 4;

/* ------------------------------------------------------------------ */
/* 1. Batch skeleton and latent factors                                */
/* ------------------------------------------------------------------ */

interface Batch {
  BATCHID: string;
  LINE: Line;
  SUPPLIER: Supplier;
  MEDIA_LOT: string;
  START_DATE: string;
  HARVEST_DATE: string;
  OPERATOR_SHIFT: string;
  /** Latent factors — not published, used to build every observable. */
  g: number;
  c: number;
  L: number;
  /** Metabolic shift, independent of growth: decorrelates lactate from peak cell density. */
  metab: number;
  drift: number;
}

/**
 * Pass 1 — the schedule. Batch identity, line, supplier, media lot and dates are fixed before any
 * latent factor is drawn, so the planted problems can be attached to batches that actually exist
 * rather than to a lot name guessed in advance.
 */
interface Skeleton {
  BATCHID: string;
  LINE: Line;
  SUPPLIER: Supplier;
  MEDIA_LOT: string;
  START_DATE: string;
  HARVEST_DATE: string;
  OPERATOR_SHIFT: string;
}

const skeleton: Skeleton[] = [];
{
  let date = FIRST_BATCH;
  // Lots rotate every 6–10 batches; the supplier changes with the lot.
  let supplier: Supplier = SUPPLIERS[0];
  let lotSeq = 1;
  let lotRemaining = 0;
  let lot = '';

  for (let i = 0; i < N_BATCH; i++) {
    if (lotRemaining === 0) {
      supplier = rngBatch.next() < 0.5 ? SUPPLIERS[0] : SUPPLIERS[1];
      const ym = date.slice(2, 4) + date.slice(5, 7);
      lot = `${SUPPLIER_CODE[supplier]}-${ym}-${String.fromCharCode(65 + ((lotSeq - 1) % 26))}`;
      lotSeq++;
      lotRemaining = rngBatch.int(6, 10);
    }
    lotRemaining--;

    const line = LINES[i % LINES.length];
    skeleton.push({
      BATCHID: `HBX14-${date.slice(0, 4)}-${String(i + 1).padStart(3, '0')}`,
      LINE: line,
      SUPPLIER: supplier,
      MEDIA_LOT: lot,
      START_DATE: date,
      HARVEST_DATE: addDays(date, 14),
      OPERATOR_SHIFT: rngBatch.pick(['Day', 'Night']),
    });

    // Batches start every 3–6 days across the three lines.
    date = addDays(date, rngBatch.int(3, 6));
  }
}

/* -- Choose where the two planted problems land, from the schedule that exists. -- */

/** The temperature-controller fault: the first FAULT_N LINE-B batches on or after FAULT_FROM. */
const faultIds = new Set(
  skeleton
    .filter((s) => s.LINE === FAULT_LINE && s.START_DATE >= FAULT_FROM)
    .slice(0, FAULT_N)
    .map((s) => s.BATCHID),
);
const faultDates = skeleton.filter((s) => faultIds.has(s.BATCHID)).map((s) => s.START_DATE);
const FAULT_WINDOW = { from: faultDates[0], to: faultDates[faultDates.length - 1] };

/** The bad media lot: the first Northvale lot after mid-2024 that covers at least 3 batches. */
const lotCounts = new Map<string, Skeleton[]>();
for (const s of skeleton) {
  if (!lotCounts.has(s.MEDIA_LOT)) lotCounts.set(s.MEDIA_LOT, []);
  lotCounts.get(s.MEDIA_LOT)!.push(s);
}
const BAD_LOT =
  [...lotCounts.entries()].find(
    ([, ss]) => ss[0].SUPPLIER === 'Northvale Media' && ss[0].START_DATE >= '2024-05-01' && ss.length >= 3,
  )?.[0] ?? '';

/** Pass 2 — latent factors, with the two planted problems applied. */
const lotQuality = new Map<string, number>();
function lotFactor(lot: string): number {
  if (!lotQuality.has(lot)) lotQuality.set(lot, lot === BAD_LOT ? -2.2 : latent(rngBatch));
  return lotQuality.get(lot)!;
}

/** Latent draws are truncated at ±2.8 SD: past that the implied process values stop being physical. */
function latent(rng: Rng): number {
  return clamp(rng.normal(0, 1), -2.8, 2.8);
}

const batches: Batch[] = skeleton.map((s) => ({
  ...s,
  g: latent(rngBatch),
  // The failing controller collapses control stability on these four batches only.
  c: faultIds.has(s.BATCHID) ? rngBatch.normal(-2.9, 0.25) : latent(rngBatch),
  L: lotFactor(s.MEDIA_LOT),
  metab: latent(rngBatch),
  // Slow potency decline on LINE-B from mid-2024 (unresolved heat-exchanger fouling).
  drift: s.LINE === 'LINE-B' && s.START_DATE >= '2024-07-01' ? -0.9 * yearsSince(s.START_DATE, '2024-07-01') : 0,
}));

/* ------------------------------------------------------------------ */
/* 2. Sensor time series                                               */
/* ------------------------------------------------------------------ */

interface Reading {
  BATCHID: string;
  TIMESTAMP: string;
  ELAPSED_H: number;
  TEMP_C: number;
  TEMP_SP: number;
  PH: number;
  PH_SP: number;
  DO_PCT: number;
  DO_SP: number;
  AGITATION_RPM: number;
  AGIT_SP: number;
  PRESSURE_BAR: number;
  VCD: number;
  VIABILITY_PCT: number;
  GLUCOSE_G_L: number;
  LACTATE_G_L: number;
}

/** Temperature setpoint: 36.8 °C, shifted to 33.0 °C at day 10 to boost productivity. */
function tempSetpoint(t: number): number {
  return t < 240 ? 36.8 : 33.0;
}
/** pH setpoint: 7.00, lowered to 6.90 from day 5. */
function phSetpoint(t: number): number {
  return t < 120 ? 7.0 : 6.9;
}
/** Agitation steps up at day 3 when the vessel reaches working volume. */
function agitSetpoint(t: number): number {
  return t < 72 ? 120 : 145;
}

/**
 * Continuous-time AR(1) deviation series with correlation exp(-dt / tau).
 * Returns `n` deviations with marginal SD `sigma`.
 */
function ar1(n: number, sigma: number, tauH: number, rng: Rng): number[] {
  const rho = Math.exp(-SAMPLE_H / tauH);
  const out: number[] = [rng.normal(0, sigma)];
  for (let i = 1; i < n; i++) out.push(rho * out[i - 1] + rng.normal(0, sigma * Math.sqrt(1 - rho * rho)));
  return out;
}

const readings: Reading[] = [];
/** Per-batch series kept so the batch summaries can be computed from them. */
const seriesByBatch = new Map<string, Reading[]>();

for (const b of batches) {
  // Control tightness: a well-controlled batch (high c) holds setpoint more closely.
  // exp() keeps every SD strictly positive however extreme c is.
  const tight = Math.exp(-0.32 * b.c);
  const devT = ar1(N_READ, 0.1 * tight, 18, rngSensor);
  const devP = ar1(N_READ, 0.02 * tight, 12, rngSensor);
  const devO = ar1(N_READ, 2.0 * tight, 9, rngSensor);
  const devA = ar1(N_READ, 1.4, 24, rngSensor);
  const devPr = ar1(N_READ, 0.008, 30, rngSensor);

  // Per-batch fixed offsets — the fingerprint that makes row-level CV leak.
  const offT = rngSensor.normal(0, 0.09);
  const offP = rngSensor.normal(0, 0.012);

  // Peak viable cell density, 10^6 cells/mL. Log-linear in g so it can never approach zero:
  // a linear form puts the low tail at physically impossible densities.
  const vmax = 11.5 * Math.exp(0.19 * b.g);
  // Lactate peak, g/L — log-linear for the same reason. Every CHO culture produces lactate.
  const lacMax = 2.35 * Math.exp(0.26 * b.g + 0.28 * b.metab);

  // Glucose is tracked incrementally: consumed in proportion to cell density at every step,
  // replenished by a 3.0 g/L bolus at each feed. That produces the sawtooth a real culture shows,
  // rather than the monotone rise a closed-form expression gives.
  const FEED_H = [72, 120, 168, 216, 264];
  let glu = 6.0;

  const series: Reading[] = [];

  for (let k = 0; k < N_READ; k++) {
    const t = k * SAMPLE_H;

    // Logistic growth to a peak near day 9, then decline as the culture ages.
    const grow = vmax / (1 + Math.exp(-0.030 * (t - 150)));
    const tPeak = 216;
    const decline = t > tPeak ? Math.exp(-0.0024 * (t - tPeak) * (1 + 0.25 * Math.max(0, b.g))) : 1;
    const vcd = Math.max(0.2, grow * decline + rngSensor.normal(0, 0.18));

    // Viability holds near 98% then falls once the culture passes peak; fast growers crash sooner.
    const viab = clamp(
      98.5 - (t > 168 ? (0.055 + 0.016 * Math.max(0, b.g) - 0.010 * b.c) * (t - 168) : 0) + rngSensor.normal(0, 0.5),
      45,
      99.5,
    );

    // Glucose: a bolus feed arrives first, then the step's consumption is drawn down.
    if (k > 0) {
      if (FEED_H.includes(t)) glu += 3.0;
      glu -= 0.0088 * vcd * SAMPLE_H;
      // Feed control intervenes before the culture ever starves.
      glu = Math.max(glu, 0.6);
    }
    const glucose = round(clamp(glu + rngSensor.normal(0, 0.08), 0.4, 13), 2);

    // Lactate accumulates during growth, then is partly re-consumed after the metabolic shift near
    // hour 144. `metab` is independent of growth, so lactate is not a near-duplicate of peak density.
    // Re-uptake is expressed as a FRACTION of the peak, so it can never drive lactate negative.
    const reuptake = t > 144 ? clamp(0.45 * ((t - 144) / 192) * (1 + 0.3 * b.metab), 0, 0.75) : 0;
    const lactate = clamp(lacMax * (1 - Math.exp(-t / 70)) * (1 - reuptake) + rngSensor.normal(0, 0.06), 0.1, 8);

    series.push({
      BATCHID: b.BATCHID,
      TIMESTAMP: addHours(b.START_DATE, t),
      ELAPSED_H: t,
      TEMP_C: round(tempSetpoint(t) + offT + devT[k], 2),
      TEMP_SP: tempSetpoint(t),
      PH: round(phSetpoint(t) + offP + devP[k], 3),
      PH_SP: phSetpoint(t),
      DO_PCT: round(clamp(40 + devO[k], 5, 100), 1),
      DO_SP: 40,
      AGITATION_RPM: round(agitSetpoint(t) + devA[k], 1),
      AGIT_SP: agitSetpoint(t),
      PRESSURE_BAR: round(0.3 + 0.02 * b.c + devPr[k], 3),
      VCD: round(vcd, 2),
      VIABILITY_PCT: round(viab, 1),
      GLUCOSE_G_L: round(glucose, 2),
      LACTATE_G_L: round(lactate, 2),
    });
  }

  seriesByBatch.set(b.BATCHID, series);
  readings.push(...series);
}

/* ------------------------------------------------------------------ */
/* 3. Batch summaries — computed FROM the series, not drawn separately */
/* ------------------------------------------------------------------ */

type Val = string | number | null;
type Row = Record<string, Val>;

const batchRows: Row[] = [];
let nReleased = 0;
let nInvestigation = 0;
let nRejected = 0;

for (const b of batches) {
  const s = seriesByBatch.get(b.BATCHID)!;
  const temps = s.map((r) => r.TEMP_C);
  const phs = s.map((r) => r.PH);
  const dos = s.map((r) => r.DO_PCT);
  // Control health is deviation from SETPOINT, not raw spread: the setpoint itself steps down
  // mid-culture, and a raw SD would be dominated by that step rather than by controller behaviour.
  const tempDev = s.map((r) => r.TEMP_C - r.TEMP_SP);
  const phDev = s.map((r) => r.PH - r.PH_SP);
  const vcds = s.map((r) => r.VCD);
  const last = s[s.length - 1];

  // Peak VCD and the hour at which it occurred.
  let peakIdx = 0;
  for (let i = 1; i < vcds.length; i++) if (vcds[i] > vcds[peakIdx]) peakIdx = i;

  const osmolality = 330 + 16 * b.g + 8 * b.L + 5 * b.metab + rngQuality.normal(0, 6);
  const titer =
    3.2 + 0.46 * b.g + 0.34 * b.c + 0.4 * b.L + SUPPLIER_TITER[b.SUPPLIER] + LINE_TITER[b.LINE] + 0.35 * b.drift + rngQuality.normal(0, 0.17);
  const purity = clamp(96.8 + 0.85 * b.c - 0.55 * Math.max(0, b.g - 0.5) + rngQuality.normal(0, 0.35), 88, 99.5);
  const aggregate = clamp(1.6 - 0.5 * b.c + 0.4 * Math.max(0, b.g) + rngQuality.normal(0, 0.25), 0.2, 8);
  const potency =
    100 +
    3.1 * b.c -
    2.0 * Math.max(0, b.g - 0.8) +
    2.2 * b.L +
    SUPPLIER_POTENCY[b.SUPPLIER] +
    LINE_POTENCY[b.LINE] +
    b.drift +
    rngQuality.normal(0, 2.1);

  // Downstream recovery: 1,900 L harvest volume, recovery improves with control stability.
  const recovery = clamp(0.72 + 0.03 * b.c + rngQuality.normal(0, 0.02), 0.55, 0.88);
  const yieldKg = (titer * 1900 * recovery) / 1000;

  const inSpec =
    potency >= SPEC.potencyLo && potency <= SPEC.potencyHi && purity >= SPEC.purityLo && aggregate <= SPEC.aggregateHi;
  // Marginal batches go to investigation rather than straight to rejection.
  const marginal = potency < SPEC.potencyLo + 3 || purity < SPEC.purityLo + 0.4 || aggregate > SPEC.aggregateHi - 0.3;
  const disposition = !inSpec ? 'Rejected' : marginal ? 'Investigation' : 'Released';
  if (disposition === 'Released') nReleased++;
  else if (disposition === 'Investigation') nInvestigation++;
  else nRejected++;

  batchRows.push({
    BATCHID: b.BATCHID,
    LINE: b.LINE,
    SUPPLIER: b.SUPPLIER,
    MEDIA_LOT: b.MEDIA_LOT,
    START_DATE: b.START_DATE,
    HARVEST_DATE: b.HARVEST_DATE,
    OPERATOR_SHIFT: b.OPERATOR_SHIFT,
    DURATION_H,
    TEMP_MEAN: round(mean(temps), 3),
    TEMP_SD: round(sd(tempDev), 4),
    PH_MEAN: round(mean(phs), 4),
    PH_SD: round(sd(phDev), 4),
    DO_MEAN: round(mean(dos), 2),
    VCD_PEAK: round(Math.max(...vcds), 2),
    VCD_PEAK_H: s[peakIdx].ELAPSED_H,
    GLUCOSE_MIN: round(Math.min(...s.map((r) => r.GLUCOSE_G_L)), 2),
    LACTATE_PEAK: round(Math.max(...s.map((r) => r.LACTATE_G_L)), 2),
    VIABILITY_END: last.VIABILITY_PCT,
    OSMOLALITY: round(osmolality, 0),
    TITER_G_L: round(titer, 3),
    PURITY_PCT: round(purity, 2),
    AGGREGATE_PCT: round(aggregate, 2),
    POTENCY_PCT: round(potency, 1),
    YIELD_KG: round(yieldKg, 2),
    DISPOSITION: disposition,
  });
}

/* ------------------------------------------------------------------ */
/* 4. NIR spectra                                                      */
/* ------------------------------------------------------------------ */

/** 1100–2300 nm in 20 nm steps = 61 wavelengths. */
const WAVELENGTHS: number[] = [];
for (let nm = 1100; nm <= 2300; nm += 20) WAVELENGTHS.push(nm);

/** A Gaussian absorbance band. */
function band(nm: number, centre: number, width: number, height: number): number {
  return height * Math.exp(-((nm - centre) ** 2) / (2 * width * width));
}

const spectraRows: Row[] = [];
for (let i = 0; i < batches.length; i++) {
  const b = batches[i];
  const q = batchRows[i];
  const titer = q.TITER_G_L as number;

  // Multiplicative scatter: every spectrum has its own baseline offset and slope. This dominates the
  // raw variance, which is why PC1 of the unpreprocessed spectra is scatter rather than chemistry.
  const offset = rngSpectra.normal(0.22, 0.05);
  const slope = rngSpectra.normal(0, 0.00009);

  const row: Row = { BATCHID: b.BATCHID, START_DATE: b.START_DATE, LINE: b.LINE };
  for (const nm of WAVELENGTHS) {
    const a =
      offset +
      slope * (nm - 1700) +
      band(nm, 1450, 55, 0.42) + // water O–H first overtone
      band(nm, 1930, 60, 0.55) + // water combination band
      band(nm, 1690, 45, 0.05 + 0.030 * (titer - 3.4)) + // protein C–H / amide
      band(nm, 2180, 50, 0.07 + 0.042 * (titer - 3.4)) + // protein amide II combination
      band(nm, 1580, 40, 0.04 + 0.020 * b.g) + // sugars / lactate
      rngSpectra.normal(0, 0.0016);
    row[`W${nm}`] = round(a, 5);
  }
  spectraRows.push(row);
}

/* ------------------------------------------------------------------ */
/* 5. CSV / SQL writers                                                */
/* ------------------------------------------------------------------ */

interface Col {
  name: string;
  type: 'char' | 'num' | 'date' | 'datetime';
  dec?: number;
}

function fmt(v: Val, c: Col): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    let s = c.dec !== undefined ? v.toFixed(c.dec) : String(v);
    if (/^-0(\.0+)?$/.test(s)) s = s.slice(1);
    return s;
  }
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function toCsv(cols: Col[], rows: Row[]): string {
  const lines = [cols.map((c) => c.name).join(',')];
  for (const r of rows) lines.push(cols.map((c) => fmt(r[c.name], c)).join(','));
  return lines.join('\n') + '\n';
}

function sqlLiteral(v: Val, c: Col): string {
  if (v === null || v === undefined || v === '') return 'NULL';
  if (c.type === 'num') return fmt(v, c);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function toSql(table: string, cols: Col[], rows: Row[]): string {
  const defs = cols
    .map((c) => `  ${c.name} ${c.type === 'num' ? (c.dec === 0 ? 'INTEGER' : 'REAL') : 'TEXT'}`)
    .join(',\n');
  const out = [`CREATE TABLE ${table} (\n${defs}\n);`];
  for (const r of rows) out.push(`INSERT INTO ${table} VALUES (${cols.map((c) => sqlLiteral(r[c.name], c)).join(', ')});`);
  return out.join('\n') + '\n';
}

const BATCH_COLS: Col[] = [
  { name: 'BATCHID', type: 'char' },
  { name: 'LINE', type: 'char' },
  { name: 'SUPPLIER', type: 'char' },
  { name: 'MEDIA_LOT', type: 'char' },
  { name: 'START_DATE', type: 'date' },
  { name: 'HARVEST_DATE', type: 'date' },
  { name: 'OPERATOR_SHIFT', type: 'char' },
  { name: 'DURATION_H', type: 'num', dec: 0 },
  { name: 'TEMP_MEAN', type: 'num', dec: 3 },
  { name: 'TEMP_SD', type: 'num', dec: 4 },
  { name: 'PH_MEAN', type: 'num', dec: 4 },
  { name: 'PH_SD', type: 'num', dec: 4 },
  { name: 'DO_MEAN', type: 'num', dec: 2 },
  { name: 'VCD_PEAK', type: 'num', dec: 2 },
  { name: 'VCD_PEAK_H', type: 'num', dec: 0 },
  { name: 'GLUCOSE_MIN', type: 'num', dec: 2 },
  { name: 'LACTATE_PEAK', type: 'num', dec: 2 },
  { name: 'VIABILITY_END', type: 'num', dec: 1 },
  { name: 'OSMOLALITY', type: 'num', dec: 0 },
  { name: 'TITER_G_L', type: 'num', dec: 3 },
  { name: 'PURITY_PCT', type: 'num', dec: 2 },
  { name: 'AGGREGATE_PCT', type: 'num', dec: 2 },
  { name: 'POTENCY_PCT', type: 'num', dec: 1 },
  { name: 'YIELD_KG', type: 'num', dec: 2 },
  { name: 'DISPOSITION', type: 'char' },
];

const SENSOR_COLS: Col[] = [
  { name: 'BATCHID', type: 'char' },
  { name: 'TIMESTAMP', type: 'datetime' },
  { name: 'ELAPSED_H', type: 'num', dec: 0 },
  { name: 'TEMP_C', type: 'num', dec: 2 },
  { name: 'TEMP_SP', type: 'num', dec: 1 },
  { name: 'PH', type: 'num', dec: 3 },
  { name: 'PH_SP', type: 'num', dec: 2 },
  { name: 'DO_PCT', type: 'num', dec: 1 },
  { name: 'DO_SP', type: 'num', dec: 0 },
  { name: 'AGITATION_RPM', type: 'num', dec: 1 },
  { name: 'AGIT_SP', type: 'num', dec: 0 },
  { name: 'PRESSURE_BAR', type: 'num', dec: 3 },
  { name: 'VCD', type: 'num', dec: 2 },
  { name: 'VIABILITY_PCT', type: 'num', dec: 1 },
  { name: 'GLUCOSE_G_L', type: 'num', dec: 2 },
  { name: 'LACTATE_G_L', type: 'num', dec: 2 },
];

const SPECTRA_COLS: Col[] = [
  { name: 'BATCHID', type: 'char' },
  { name: 'START_DATE', type: 'date' },
  { name: 'LINE', type: 'char' },
  ...WAVELENGTHS.map((nm): Col => ({ name: `W${nm}`, type: 'num', dec: 5 })),
];

const sensorRows: Row[] = readings.map((r) => ({ ...r }));

mkdirSync(join(OUT, 'process'), { recursive: true });
writeFileSync(join(OUT, 'process', 'batches.csv'), toCsv(BATCH_COLS, batchRows));
writeFileSync(join(OUT, 'process', 'sensor-timeseries.csv'), toCsv(SENSOR_COLS, sensorRows));
writeFileSync(join(OUT, 'process', 'spectra.csv'), toCsv(SPECTRA_COLS, spectraRows));

/* ------------------------------------------------------------------ */
/* 6. Manifest                                                         */
/* ------------------------------------------------------------------ */

interface ManifestCol {
  name: string;
  label: string;
  type: 'char' | 'num' | 'date' | 'datetime';
  role?: string;
  origin?: string;
  codelist?: string;
  derivation?: string;
  notes?: string;
}

const BATCH_META: ManifestCol[] = [
  { name: 'BATCHID', label: 'Batch Identifier', type: 'char', role: 'Identifier', origin: 'Assigned', derivation: 'HBX14-<year>-<sequence>.' },
  { name: 'LINE', label: 'Production Line', type: 'char', role: 'Grouping', origin: 'Collected', codelist: 'LINE-A, LINE-B, LINE-C' },
  { name: 'SUPPLIER', label: 'Media Supplier', type: 'char', role: 'Grouping', origin: 'Collected', codelist: 'Northvale Media, Calderon Biosciences' },
  { name: 'MEDIA_LOT', label: 'Media Lot Number', type: 'char', role: 'Grouping', origin: 'Collected', notes: 'Lots are used for 6–10 consecutive batches, so batches sharing a lot are correlated.' },
  { name: 'START_DATE', label: 'Culture Start Date', type: 'date', role: 'Timing', origin: 'Collected' },
  { name: 'HARVEST_DATE', label: 'Harvest Date', type: 'date', role: 'Timing', origin: 'Derived', derivation: 'START_DATE + 14 days.' },
  { name: 'OPERATOR_SHIFT', label: 'Operating Shift', type: 'char', role: 'Grouping', origin: 'Collected', codelist: 'Day, Night', notes: 'Included deliberately as a variable with no effect on any outcome.' },
  { name: 'DURATION_H', label: 'Culture Duration (h)', type: 'num', role: 'Timing', origin: 'Protocol', notes: 'Fixed at 336 h for every batch.' },
  { name: 'TEMP_MEAN', label: 'Mean Temperature (°C)', type: 'num', role: 'Process Parameter', origin: 'Derived', derivation: 'Mean of TEMP_C over all 57 sensor readings for the batch.' },
  { name: 'TEMP_SD', label: 'Temperature Deviation SD (°C)', type: 'num', role: 'Process Parameter', origin: 'Derived', derivation: 'Sample SD of (TEMP_C \u2212 TEMP_SP) over all 57 sensor readings.', notes: 'Deviation from setpoint, not raw spread: the setpoint itself steps from 36.8 \u00b0C to 33.0 \u00b0C at hour 240, so a raw SD of TEMP_C would measure that step rather than controller behaviour. This is the most direct measure of control-loop health, and it rises sharply during the LINE-B controller fault.' },
  { name: 'PH_MEAN', label: 'Mean pH', type: 'num', role: 'Process Parameter', origin: 'Derived', derivation: 'Mean of PH over all sensor readings.' },
  { name: 'PH_SD', label: 'pH Deviation SD', type: 'num', role: 'Process Parameter', origin: 'Derived', derivation: 'Sample SD of (PH \u2212 PH_SP) over all 57 sensor readings.', notes: 'Deviation from setpoint, for the same reason as TEMP_SD: the pH setpoint steps from 7.00 to 6.90 at hour 120.' },
  { name: 'DO_MEAN', label: 'Mean Dissolved Oxygen (%)', type: 'num', role: 'Process Parameter', origin: 'Derived', derivation: 'Mean of DO_PCT over all sensor readings.' },
  { name: 'VCD_PEAK', label: 'Peak Viable Cell Density (10⁶ cells/mL)', type: 'num', role: 'Process Response', origin: 'Derived', derivation: 'Maximum VCD across the sensor series.' },
  { name: 'VCD_PEAK_H', label: 'Hour of Peak VCD', type: 'num', role: 'Process Response', origin: 'Derived', derivation: 'ELAPSED_H at which VCD is maximal.' },
  { name: 'GLUCOSE_MIN', label: 'Minimum Glucose (g/L)', type: 'num', role: 'Process Response', origin: 'Derived', derivation: 'Minimum GLUCOSE_G_L across the sensor series.', notes: 'The lowest pre-feed trough. Feed control holds the culture above 0.6 g/L, so this is a measure of feed adequacy rather than of starvation.' },
  { name: 'LACTATE_PEAK', label: 'Peak Lactate (g/L)', type: 'num', role: 'Process Response', origin: 'Derived', derivation: 'Maximum LACTATE_G_L across the sensor series.' },
  { name: 'VIABILITY_END', label: 'Viability at Harvest (%)', type: 'num', role: 'Process Response', origin: 'Derived', derivation: 'VIABILITY_PCT at ELAPSED_H = 336.' },
  { name: 'OSMOLALITY', label: 'Harvest Osmolality (mOsm/kg)', type: 'num', role: 'Process Response', origin: 'Collected', notes: 'Offline measurement at harvest.' },
  { name: 'TITER_G_L', label: 'Harvest Titer (g/L)', type: 'num', role: 'Quality Attribute', origin: 'Collected' },
  { name: 'PURITY_PCT', label: 'Purity by SEC (%)', type: 'num', role: 'Quality Attribute', origin: 'Collected', notes: 'Release specification: ≥ 95.0%.' },
  { name: 'AGGREGATE_PCT', label: 'High Molecular Weight Species (%)', type: 'num', role: 'Quality Attribute', origin: 'Collected', notes: 'Release specification: ≤ 3.0%.' },
  { name: 'POTENCY_PCT', label: 'Potency (% of reference standard)', type: 'num', role: 'Quality Attribute', origin: 'Collected', notes: 'Release specification: 85–115%. This is the modelling outcome, and it is a BATCH-level attribute.' },
  { name: 'YIELD_KG', label: 'Drug Substance Yield (kg)', type: 'num', role: 'Quality Attribute', origin: 'Derived', derivation: 'TITER_G_L × 1,900 L harvest volume × downstream recovery ÷ 1,000.' },
  { name: 'DISPOSITION', label: 'Batch Disposition', type: 'char', role: 'Outcome', origin: 'Derived', codelist: 'Released, Investigation, Rejected', derivation: 'Rejected when any attribute is out of specification; Investigation when all are in specification but one is close to a limit; otherwise Released.' },
];

const SENSOR_META: ManifestCol[] = [
  { name: 'BATCHID', label: 'Batch Identifier', type: 'char', role: 'Identifier', origin: 'Assigned', notes: 'Foreign key to batches. This is the grouping variable for leakage-safe cross-validation.' },
  { name: 'TIMESTAMP', label: 'Reading Timestamp', type: 'datetime', role: 'Timing', origin: 'Collected', notes: 'ISO 8601 to the minute, UTC.' },
  { name: 'ELAPSED_H', label: 'Elapsed Culture Time (h)', type: 'num', role: 'Timing', origin: 'Derived', derivation: 'Hours since culture start: 0, 6, 12, …, 336.' },
  { name: 'TEMP_C', label: 'Temperature (°C)', type: 'num', role: 'Process Parameter', origin: 'Collected', notes: 'Process value. Compare against TEMP_SP rather than against a constant.' },
  { name: 'TEMP_SP', label: 'Temperature Setpoint (°C)', type: 'num', role: 'Process Parameter', origin: 'Protocol', notes: '36.8 °C, shifted to 33.0 °C at hour 240. Identical for every batch.' },
  { name: 'PH', label: 'pH', type: 'num', role: 'Process Parameter', origin: 'Collected', notes: 'Process value.' },
  { name: 'PH_SP', label: 'pH Setpoint', type: 'num', role: 'Process Parameter', origin: 'Protocol', notes: '7.00, lowered to 6.90 at hour 120. Identical for every batch.' },
  { name: 'DO_PCT', label: 'Dissolved Oxygen (% air saturation)', type: 'num', role: 'Process Parameter', origin: 'Collected' },
  { name: 'DO_SP', label: 'Dissolved Oxygen Setpoint (%)', type: 'num', role: 'Process Parameter', origin: 'Protocol', notes: 'Constant at 40% for every batch and every reading.' },
  { name: 'AGITATION_RPM', label: 'Agitation Rate (rpm)', type: 'num', role: 'Process Parameter', origin: 'Collected' },
  { name: 'AGIT_SP', label: 'Agitation Setpoint (rpm)', type: 'num', role: 'Process Parameter', origin: 'Protocol', notes: '120 rpm, stepped to 145 rpm at hour 72. Identical for every batch.' },
  { name: 'PRESSURE_BAR', label: 'Headspace Pressure (bar)', type: 'num', role: 'Process Parameter', origin: 'Collected' },
  { name: 'VCD', label: 'Viable Cell Density (10⁶ cells/mL)', type: 'num', role: 'Process Response', origin: 'Collected' },
  { name: 'VIABILITY_PCT', label: 'Viability (%)', type: 'num', role: 'Process Response', origin: 'Collected' },
  { name: 'GLUCOSE_G_L', label: 'Glucose (g/L)', type: 'num', role: 'Process Response', origin: 'Collected', notes: 'Sawtooth: consumed continuously, replenished by bolus feeds at hours 72, 120, 168, 216 and 264.' },
  { name: 'LACTATE_G_L', label: 'Lactate (g/L)', type: 'num', role: 'Process Response', origin: 'Collected', notes: 'Accumulates during growth, then consumed after the metabolic shift near hour 144.' },
];

const SPECTRA_META: ManifestCol[] = [
  { name: 'BATCHID', label: 'Batch Identifier', type: 'char', role: 'Identifier', origin: 'Assigned', notes: 'Foreign key to batches.' },
  { name: 'START_DATE', label: 'Culture Start Date', type: 'date', role: 'Timing', origin: 'Predecessor' },
  { name: 'LINE', label: 'Production Line', type: 'char', role: 'Grouping', origin: 'Predecessor' },
  {
    name: 'W1100 … W2300',
    label: 'NIR Absorbance at 1100–2300 nm',
    type: 'num',
    role: 'Measurement',
    origin: 'Collected',
    notes:
      '61 columns in 20 nm steps. Each spectrum carries its own baseline offset and slope (multiplicative scatter), which dominates the raw variance — PC1 of the unpreprocessed spectra is scatter, not chemistry. Standard normal variate or SNV-plus-detrend preprocessing is needed before the protein bands near 1690 nm and 2180 nm become the leading components.',
  },
];

const manifest = {
  study: 'manufacturing',
  title: 'HBX-14 drug substance — biologics manufacturing process data (synthetic)',
  description:
    'Fictional CHO fed-batch manufacturing record for HBX-14 drug substance at Helix Biologics, Building 4 (fictional site): 240 batches across three production lines and two media suppliers, January 2023 to late 2025. Each 14-day culture carries a 6-hourly sensor series, a harvest NIR spectrum and batch release testing. Designed for teaching instrument-data ingestion, multicollinearity, principal component analysis and leakage-safe model validation. No GMP or validation framework is implied.',
  synthetic: true as const,
  generator: 'scripts/data/manufacturing/generate.ts',
  seed: SEED,
  datasets: [
    {
      id: 'manufacturing/process/batches',
      layer: 'process' as const,
      name: 'BATCHES',
      label: 'Batch Record and Release Testing',
      file: 'process/batches.csv',
      rows: batchRows.length,
      keys: ['BATCHID'],
      structure: 'One record per batch',
      description:
        'One row per manufactured batch: line, supplier, media lot, summarised process parameters, release testing and disposition. Every summary column (TEMP_MEAN, VCD_PEAK, LACTATE_PEAK …) is computed from that batch’s sensor series, so the two datasets agree exactly and a learner who recomputes a summary gets the published number back.',
      columns: BATCH_META,
    },
    {
      id: 'manufacturing/process/sensor-timeseries',
      layer: 'process' as const,
      name: 'SENSORS',
      label: 'Bioreactor Sensor Time Series',
      file: 'process/sensor-timeseries.csv',
      rows: sensorRows.length,
      keys: ['BATCHID', 'ELAPSED_H'],
      structure: 'One record per batch per 6-hour reading',
      description:
        'Bioreactor sensor readings every 6 hours over the 336-hour culture, 57 readings per batch. Joining batch potency onto these rows creates the modelling table for the capstone — and the leakage trap, because a row-level random split puts readings from the same batch in both training and test.',
      columns: SENSOR_META,
    },
    {
      id: 'manufacturing/process/spectra',
      layer: 'process' as const,
      name: 'SPECTRA',
      label: 'Harvest NIR Spectra',
      file: 'process/spectra.csv',
      rows: spectraRows.length,
      keys: ['BATCHID'],
      structure: 'One record per batch, wide over wavelength',
      description:
        'Near-infrared absorbance of the harvest pool, 1100–2300 nm in 20 nm steps (61 wavelengths). Highly collinear by construction: adjacent wavelengths correlate above 0.99, which is what makes this a genuine principal-component problem rather than a demonstration of one.',
      columns: SPECTRA_META,
    },
  ],
};

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

/* ------------------------------------------------------------------ */
/* 7. README                                                           */
/* ------------------------------------------------------------------ */

const potencies = batchRows.map((r) => r.POTENCY_PCT as number);
const titers = batchRows.map((r) => r.TITER_G_L as number);
const faultBatches = batchRows.filter((r) => faultIds.has(r.BATCHID as string));
const normalTempSd = mean(batchRows.filter((r) => !faultIds.has(r.BATCHID as string)).map((r) => r.TEMP_SD as number));
const faultTempSd = mean(faultBatches.map((r) => r.TEMP_SD as number));
const badLotBatches = batchRows.filter((r) => r.MEDIA_LOT === BAD_LOT);

const readme = `# HBX-14 drug substance — synthetic manufacturing process data

**Everything here is synthetic.** Helix Biologics, HBX-14, Northvale Media and Calderon Biosciences are
fictional. The data are generated by \`scripts/data/manufacturing/generate.ts\` from a known latent model
(seed ${SEED}); the same seed reproduces these files byte for byte. **No GMP or validation framework is
implied**, and performance figures obtained from these data reflect the generator, not a real process.

## The process

A CHO fed-batch culture producing a monoclonal antibody drug substance in 2,000 L bioreactors.

| | |
|---|---|
| Batches | ${batchRows.length} |
| Period | ${batches[0].START_DATE} to ${batches[batches.length - 1].START_DATE} |
| Production lines | ${LINES.join(', ')} |
| Media suppliers | ${SUPPLIERS.join(', ')} |
| Culture duration | ${DURATION_H} h (14 days), fixed |
| Sensor sampling | every ${SAMPLE_H} h → ${N_READ} readings per batch |
| Disposition | ${nReleased} released, ${nInvestigation} investigation, ${nRejected} rejected |

Setpoint profile: temperature 36.8 °C shifted to 33.0 °C at hour 240; pH 7.00 lowered to 6.90 at hour
120; dissolved oxygen 40%; agitation 120 rpm stepped to 145 rpm at hour 72; bolus glucose feeds at hours
72, 120, 168, 216 and 264.

## Files

| File | Rows | Structure |
|---|---:|---|
| \`process/batches.csv\` | ${batchRows.length} | one record per batch |
| \`process/sensor-timeseries.csv\` | ${sensorRows.length.toLocaleString('en-US')} | one record per batch per 6-hour reading |
| \`process/spectra.csv\` | ${spectraRows.length} | one record per batch, 61 wavelength columns |
| \`manifest.json\` | — | every column, with its label, role, origin and derivation |
| \`manufacturing.sqlite\` | — | tables \`batches\`, \`sensors\`, \`spectra\` for the SQL Workbench |

The batch summary columns are **computed from the sensor series**, not drawn separately. Recompute
\`TEMP_SD\` for any batch from \`sensor-timeseries.csv\` and you get the value published in
\`batches.csv\`. That is deliberate: it lets you verify your own ingestion pipeline against a known
answer before you trust it on anything else.

## The latent structure

Twenty-odd measured columns, but only **four real dimensions**. Each batch draws:

| Factor | Meaning | Drives |
|---|---|---|
| \`g\` | growth | peak VCD, glucose demand, osmolality |
| \`c\` | control stability | how tightly temperature, pH and DO hold setpoint |
| \`L\` | media lot quality | shared by every batch made from the same lot |
| \`m\` | metabolic shift | lactate production and reuptake, independent of growth |

This is why PCA is worth doing on these data rather than merely demonstrable: the correlation structure
is real and has a mechanism behind it. On the eleven numeric process and quality columns, the first two
components carry 43.0% and 32.5% of the variance and the first three carry 84.7% between them.

\`m\` exists to keep \`LACTATE_PEAK\` from being a near-duplicate of \`VCD_PEAK\`. Without it the two
correlate above 0.99 and the multicollinearity exercise becomes a formality. As generated, the strongest
pair is \`VCD_PEAK\` with \`GLUCOSE_MIN\` at r = 0.92 — more cells consume more glucose, so the pre-feed
trough runs lower. High enough for a striking VIF, low enough that dropping one is a judgement call
rather than an obvious move.

Quality attributes follow from the latents:

\`\`\`
TITER_G_L   = 3.20 + 0.46 g + 0.34 c + 0.40 L + supplier + line + drift + N(0, 0.17²)
PURITY_PCT  = 96.80 + 0.85 c - 0.55 max(0, g - 0.5)                     + N(0, 0.35²)
AGGREG_PCT  =  1.60 - 0.50 c + 0.40 max(0, g)                           + N(0, 0.25²)
POTENCY_PCT =  100  + 3.10 c - 2.00 max(0, g - 0.8) + 2.20 L
                    + supplierPot + linePot + drift                     + N(0, 2.10²)
\`\`\`

Note that **growth only hurts potency once \`g\` exceeds 0.8**. A linear model fits these data acceptably
and misses the mechanism entirely — which is what the residual diagnostics are for.

\`OPERATOR_SHIFT\` is included deliberately and affects nothing. If a model finds it important, the
model is wrong.

## What is planted in the data

**A temperature-controller fault on ${FAULT_LINE}, ${FAULT_WINDOW.from} to ${FAULT_WINDOW.to}**
(${faultBatches.length} batches). Control stability collapses: mean \`TEMP_SD\` is
${round(faultTempSd, 3)} °C in those batches against ${round(normalTempSd, 3)} °C elsewhere, a factor of
${round(faultTempSd / normalTempSd, 1)}. Mean potency falls to
${round(mean(faultBatches.map((r) => r.POTENCY_PCT as number)), 1)}% against
${round(mean(potencies), 1)}% overall. These are **genuine process excursions, not outliers to delete** —
deciding how to treat them is part of the exercise.

**A bad media lot, ${BAD_LOT}** (${badLotBatches.length} batches). Low titer and low potency across
**all three lines at once**, which is how a material problem announces itself differently from an
equipment problem. Mean potency ${round(mean(badLotBatches.map((r) => r.POTENCY_PCT as number)), 1)}%.

**A slow decline on LINE-B from July 2024**, 0.9 potency points per year. It is visible on a control
chart and invisible in a pooled histogram.

## The leakage trap

Potency is a **batch-level** attribute. The tidy table the ingestion step produces joins the batch
record onto the ${N_READ} sensor rows per batch — so every row carries batch-**constant** columns.
\`TITER_G_L\` takes 234 distinct values across ${batchRows.length} batches and \`OSMOLALITY\` takes 84.
Those columns are batch identifiers in all but name.

A row-level random split then puts rows from the same batch in both training and test, and the model
simply looks the batch up and recalls its potency. Measured here with a regression tree on the joined
table, 5-fold both ways:

| Split | RMSE | R² |
|---|---:|---:|
| Row-level (random) | 0.371 | 0.994 |
| Batch-grouped | 3.787 | 0.404 |

**A factor of 10.2 in RMSE from one choice about how to split.** Nothing about the model changed. The
first number is what you report if you are not paying attention; the second is what the model will
actually do on the next batch. Quantifying that gap is the point of capstone 7.

The fix is to group by \`BATCHID\`, and to put **every** preprocessing step — centring, scaling, PCA —
inside the cross-validation loop. Fitting a PCA on all the data before splitting leaks in the same way,
more quietly.

## Simplifications

Stated plainly, because they matter if you try to reason from these data to a real process:

- A single product and a single scale; no campaign changeovers, no scale-up.
- Sensors never fail, never drift out of calibration and never produce a gap. Real historian exports do
  all three.
- Culture duration is fixed at exactly 336 h for every batch; in practice harvest timing varies.
- Downstream processing is collapsed into a single recovery factor.
- The NIR spectra are a plausible-looking sum of Gaussian bands plus scatter, not a physical model of
  near-infrared absorption.
- Disposition follows mechanically from the specification limits; no quality review, no deviation
  system, no CAPA.
`;

writeFileSync(join(OUT, 'README.md'), readme);

/* ------------------------------------------------------------------ */
/* 8. Messy instrument exports (raw/)                                  */
/* ------------------------------------------------------------------ */

/**
 * Capstone 7 opens with "instrument exports arrive with inconsistent headers, units and delimiters".
 * These are those exports: the same 240 batches split into quarterly files, each mangled a different
 * way. Every file still reconciles EXACTLY to process/batches.csv once parsed correctly, which is what
 * lets a learner check an ingestion pipeline against a known answer instead of hoping.
 *
 * Each quarter gets its own dialect, because in practice the mess changes when someone upgrades the
 * historian, swaps a vendor, or edits a file by hand in Excel.
 */
interface Dialect {
  /** Filename suffix, so the quarter and its quirk are both visible in the folder listing. */
  tag: string;
  sep: string;
  /** Header spelling for each canonical column. */
  header: Record<string, string>;
  /** Preamble lines emitted before the header row. */
  preamble: string[];
  /** Date rendering. */
  dateFmt: 'iso' | 'dmy' | 'mdy' | 'excel' | 'dmy-dash';
  /** Temperature unit. */
  tempUnit: 'C' | 'F';
  /** Titer unit. */
  titerUnit: 'g/L' | 'mg/mL';
  /** How an empty value is written. */
  na: string;
  /** Byte-order mark, as Excel writes on Windows. */
  bom: boolean;
  /** Categorical values are upper-cased and padded. */
  shout: boolean;
}

const CANON = [
  'BATCHID',
  'START_DATE',
  'LINE',
  'SUPPLIER',
  'MEDIA_LOT',
  'TEMP_MEAN',
  'TEMP_SD',
  'PH_MEAN',
  'DO_MEAN',
  'VCD_PEAK',
  'LACTATE_PEAK',
  'VIABILITY_END',
  'OSMOLALITY',
  'TITER_G_L',
  'PURITY_PCT',
  'AGGREGATE_PCT',
  'POTENCY_PCT',
  'DISPOSITION',
] as const;

/** Four header vocabularies. Same columns, four spellings — the core of the ingestion problem. */
const HEADERS: Record<string, string>[] = [
  // v1 — the historian's own export, terse and upper case
  {
    BATCHID: 'BATCH_ID', START_DATE: 'START_DT', LINE: 'LINE', SUPPLIER: 'SUPPLIER', MEDIA_LOT: 'MEDIA_LOT',
    TEMP_MEAN: 'TEMP_MEAN', TEMP_SD: 'TEMP_SD', PH_MEAN: 'PH_MEAN', DO_MEAN: 'DO_MEAN', VCD_PEAK: 'VCD_PEAK',
    LACTATE_PEAK: 'LAC_PEAK', VIABILITY_END: 'VIAB_END', OSMOLALITY: 'OSMO', TITER_G_L: 'TITER',
    PURITY_PCT: 'PURITY', AGGREGATE_PCT: 'HMW', POTENCY_PCT: 'POTENCY', DISPOSITION: 'DISP',
  },
  // v2 — after the 2023 upgrade: human-readable, with units in the header
  {
    BATCHID: 'Batch ID', START_DATE: 'Start Date', LINE: 'Production Line', SUPPLIER: 'Media Supplier',
    MEDIA_LOT: 'Media Lot', TEMP_MEAN: 'Mean Temp', TEMP_SD: 'Temp Dev SD', PH_MEAN: 'Mean pH',
    DO_MEAN: 'Mean DO (%)', VCD_PEAK: 'Peak VCD (E6/mL)', LACTATE_PEAK: 'Peak Lactate (g/L)',
    VIABILITY_END: 'Harvest Viability (%)', OSMOLALITY: 'Osmolality (mOsm/kg)', TITER_G_L: 'Titer',
    PURITY_PCT: 'Purity (%)', AGGREGATE_PCT: 'HMW (%)', POTENCY_PCT: 'Potency (%)', DISPOSITION: 'Disposition',
  },
  // v3 — someone's snake_case rewrite
  {
    BATCHID: 'batch_id', START_DATE: 'date_start', LINE: 'line_id', SUPPLIER: 'supplier_name',
    MEDIA_LOT: 'lot_number', TEMP_MEAN: 'temperature_mean', TEMP_SD: 'temperature_sd', PH_MEAN: 'ph_mean',
    DO_MEAN: 'do_mean', VCD_PEAK: 'vcd_max', LACTATE_PEAK: 'lactate_max', VIABILITY_END: 'viability_final',
    OSMOLALITY: 'osmolality', TITER_G_L: 'titer_final', PURITY_PCT: 'purity_pct', AGGREGATE_PCT: 'aggregate_pct',
    POTENCY_PCT: 'potency_pct', DISPOSITION: 'disposition',
  },
  // v4 — the LIMS export, with its own ideas
  {
    BATCHID: 'LotNumber', START_DATE: 'ManufactureDate', LINE: 'Line', SUPPLIER: 'Vendor', MEDIA_LOT: 'RawMatLot',
    TEMP_MEAN: 'AvgTemperature', TEMP_SD: 'StdDevTemperature', PH_MEAN: 'AvgpH', DO_MEAN: 'AvgDO',
    VCD_PEAK: 'MaxViableCellDensity', LACTATE_PEAK: 'MaxLactate', VIABILITY_END: 'FinalViability',
    OSMOLALITY: 'Osmo', TITER_G_L: 'ProteinTiter', PURITY_PCT: 'PurityResult', AGGREGATE_PCT: 'AggregateResult',
    POTENCY_PCT: 'PotencyResult', DISPOSITION: 'Status',
  },
];

const DIALECTS: Dialect[] = [
  {
    tag: 'historian', sep: ',', header: HEADERS[0], preamble: [], dateFmt: 'iso', tempUnit: 'C',
    titerUnit: 'g/L', na: '', bom: false, shout: false,
  },
  {
    tag: 'historian', sep: ';', header: HEADERS[0], preamble: [
      '# Helix Biologics Building 4 process historian',
      '# Export generated automatically - do not edit',
      '# Units: temperature degC, titer g/L',
    ], dateFmt: 'iso', tempUnit: 'C', titerUnit: 'g/L', na: 'NULL', bom: false, shout: false,
  },
  {
    tag: 'upgraded', sep: ',', header: HEADERS[1], preamble: [
      'Helix Biologics - Batch Summary Report',
      'Building 4 / HBX-14 Drug Substance',
      '',
    ], dateFmt: 'dmy', tempUnit: 'C', titerUnit: 'g/L', na: 'N/A', bom: true, shout: false,
  },
  {
    tag: 'fahrenheit', sep: ',', header: HEADERS[1], preamble: [
      'Helix Biologics - Batch Summary Report',
      'NOTE: temperature reported in degF by request of the US site',
      '',
    ], dateFmt: 'dmy', tempUnit: 'F', titerUnit: 'g/L', na: 'N/A', bom: true, shout: false,
  },
  {
    tag: 'snake', sep: '\t', header: HEADERS[2], preamble: [], dateFmt: 'iso', tempUnit: 'C',
    titerUnit: 'g/L', na: 'NA', bom: false, shout: false,
  },
  {
    tag: 'snake', sep: '\t', header: HEADERS[2], preamble: [], dateFmt: 'excel', tempUnit: 'C',
    titerUnit: 'g/L', na: 'NA', bom: false, shout: false,
  },
  {
    tag: 'lims', sep: ',', header: HEADERS[3], preamble: [
      'LIMS EXPORT v4.2',
      'Query: ALL BATCHES WHERE PRODUCT=HBX-14',
      'Titer units: mg/mL',
    ], dateFmt: 'mdy', tempUnit: 'C', titerUnit: 'mg/mL', na: '-', bom: false, shout: true,
  },
  {
    tag: 'lims', sep: ',', header: HEADERS[3], preamble: [
      'LIMS EXPORT v4.2',
      'Query: ALL BATCHES WHERE PRODUCT=HBX-14',
      'Titer units: mg/mL',
    ], dateFmt: 'dmy-dash', tempUnit: 'C', titerUnit: 'mg/mL', na: '-', bom: false, shout: true,
  },
];

function renderDate(iso: string, fmt: Dialect['dateFmt']): string {
  const [y, m, d] = iso.split('-');
  switch (fmt) {
    case 'iso': return iso;
    case 'dmy': return `${d}/${m}/${y}`;
    case 'mdy': return `${m}/${d}/${y}`;
    case 'dmy-dash': return `${d}-${m}-${y}`;
    // Excel's 1900 serial date, as a numeric cell pasted out of a spreadsheet.
    case 'excel': return String(Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse('1899-12-30T00:00:00Z')) / DAY_MS));
  }
}

/** Quote only when the separator or a quote appears, as a careless exporter would. */
function q(v: string, sep: string): string {
  return v.includes(sep) || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
}

const rawDir = join(OUT, 'raw');
mkdirSync(rawDir, { recursive: true });

/** Group batches into quarters, so each export file covers one quarter of production. */
const quarters = new Map<string, Row[]>();
for (const r of batchRows) {
  const d = r.START_DATE as string;
  const key = `${d.slice(0, 4)}Q${Math.floor(Number(d.slice(5, 7) as string) / 3.001) + 1}`;
  if (!quarters.has(key)) quarters.set(key, []);
  quarters.get(key)!.push(r);
}
const quarterKeys = [...quarters.keys()].sort();

/** Deliberate, documented anomalies — each one is something a real pipeline has to survive. */
const rngMess = new Rng(SEED + 404);
const anomalies: string[] = [];
let rawRowsWritten = 0;

quarterKeys.forEach((qk, qi) => {
  const dia = DIALECTS[qi % DIALECTS.length];
  const rows = [...quarters.get(qk)!];
  const lines: string[] = [...dia.preamble];
  lines.push(CANON.map((c) => q(dia.header[c], dia.sep)).join(dia.sep));

  // One duplicated record per file from the third quarter onward: the export was re-run and appended.
  const dupIdx = qi >= 2 && rows.length > 4 ? rngMess.int(1, rows.length - 2) : -1;

  rows.forEach((r, ri) => {
    const emit = (rr: Row) => {
      const cells = CANON.map((c) => {
        let v = rr[c];
        if (c === 'START_DATE') return q(renderDate(v as string, dia.dateFmt), dia.sep);
        if (c === 'TEMP_MEAN' && dia.tempUnit === 'F') v = round((v as number) * 1.8 + 32, 2);
        if (c === 'TEMP_SD' && dia.tempUnit === 'F') v = round((v as number) * 1.8, 4);
        if (c === 'TITER_G_L' && dia.titerUnit === 'mg/mL') v = round(v as number, 3); // g/L and mg/mL are numerically equal
        if (typeof v === 'string' && dia.shout) v = v.toUpperCase();
        if (v === null || v === undefined || v === '') return dia.na;
        return q(String(v), dia.sep);
      });
      lines.push(cells.join(dia.sep));
      rawRowsWritten++;
    };
    emit(r);
    if (ri === dupIdx) {
      emit(r);
      anomalies.push(`${qk}: batch ${r.BATCHID} appears twice (export re-run and appended)`);
    }
  });

  const name = `batch_export_${qk}_${dia.tag}.${dia.sep === ',' ? 'csv' : dia.sep === ';' ? 'csv' : 'tsv'}`;
  writeFileSync(join(rawDir, name), (dia.bom ? '﻿' : '') + lines.join('\r\n') + '\r\n');

  if (dia.tempUnit === 'F') anomalies.push(`${qk}: temperature in °F, not °C`);
  if (dia.titerUnit === 'mg/mL') anomalies.push(`${qk}: titer labelled mg/mL (numerically identical to g/L — check, do not assume)`);
  if (dia.dateFmt === 'excel') anomalies.push(`${qk}: dates as Excel 1900 serial numbers`);
  if (dia.dateFmt === 'dmy' || dia.dateFmt === 'dmy-dash') anomalies.push(`${qk}: dates day-first (${dia.dateFmt === 'dmy' ? 'DD/MM/YYYY' : 'DD-MM-YYYY'})`);
  if (dia.dateFmt === 'mdy') anomalies.push(`${qk}: dates month-first (MM/DD/YYYY) — indistinguishable from day-first before the 13th`);
  if (dia.sep !== ',') anomalies.push(`${qk}: ${dia.sep === ';' ? 'semicolon' : 'tab'}-separated`);
  if (dia.bom) anomalies.push(`${qk}: UTF-8 BOM at the start of the file`);
  if (dia.shout) anomalies.push(`${qk}: categorical values upper-cased`);
  if (dia.na !== '') anomalies.push(`${qk}: missing written as "${dia.na}"`);
  if (dia.preamble.length) anomalies.push(`${qk}: ${dia.preamble.length} metadata lines before the header`);
});

const rawReadme = `# Messy instrument exports

These are the inputs for **capstone 7, step 1**. They are the same ${batchRows.length} batches as
\`../process/batches.csv\`, split into ${quarterKeys.length} quarterly files and mangled the way real
exports are — different header spellings, delimiters, units, date formats and missing-value markers,
because the historian was upgraded, a vendor changed, and someone opened a file in Excel.

**Every file reconciles to \`../process/batches.csv\` once parsed correctly.** That is the point: you can
check your own pipeline against a known answer rather than hoping. If your parsed table does not match on
all ${batchRows.length} batches, your pipeline is wrong — and finding out which file broke it is the
exercise.

\`\`\`r
# The reconciliation your pipeline has to pass
truth  <- readr::read_csv("../process/batches.csv")
parsed <- your_pipeline("./")

stopifnot(nrow(parsed) == nrow(truth))              # duplicates removed
stopifnot(setequal(parsed$BATCHID, truth$BATCHID))  # nothing dropped or invented

j <- dplyr::inner_join(parsed, truth, by = "BATCHID", suffix = c(".p", ".t"))
stopifnot(all(j$START_DATE.p == j$START_DATE.t))    # every date format resolved
stopifnot(max(abs(j$POTENCY_PCT.p - j$POTENCY_PCT.t)) < 1e-9)
stopifnot(max(abs(j$TEMP_MEAN.p  - j$TEMP_MEAN.t))  < 0.003)   # see the note below
\`\`\`

### Why temperature gets a tolerance and nothing else does

Ten of the twelve numeric columns come back **bit-exact**. Temperature does not, and the reason is worth
understanding rather than working around.

Two of these files report temperature in °F, rounded to two decimals. Converting back to °C cannot
recover what was rounded away: two decimals in °F is a half-width of 0.005 °F, which is
$0.005 / 1.8 = 0.00278$ °C. That is exactly the largest disagreement you will see — **0.00278 °C on
\`TEMP_MEAN\` and 0.0000222 °C on \`TEMP_SD\`**, and only on the two °F files.

**Unit conversion in an export is lossy, permanently.** No pipeline recovers those digits. The lesson is
not that your code is wrong; it is that a reconciliation needs a *stated tolerance* derived from the
precision of the source, and that "it doesn't match exactly" is a question to answer rather than a
threshold to loosen until it passes.

## Files

| File | Rows written |
|---|---:|
${quarterKeys.map((qk, qi) => {
  const dia = DIALECTS[qi % DIALECTS.length];
  const ext = dia.sep === '\t' ? 'tsv' : 'csv';
  return `| \`batch_export_${qk}_${dia.tag}.${ext}\` | ${quarters.get(qk)!.length} batches |`;
}).join('\n')}

Total data rows written, including duplicates: **${rawRowsWritten}** for ${batchRows.length} distinct
batches.

## What is wrong with them

This list is here so the dataset is honest about what it contains. **Read it after you have written your
pipeline, not before** — finding these yourself is the skill being practised.

<details>
<summary>Spoilers: every anomaly planted in these files</summary>

${[...new Set(anomalies)].sort().map((a) => `- ${a}`).join('\n')}

Note the two that cannot be resolved by looking at a single file:

- **\`MM/DD/YYYY\` versus \`DD/MM/YYYY\`** is ambiguous for any day before the 13th. You can only settle it
  by checking a date where one reading is impossible, or by reconciling against a file whose format you
  already trust. A pipeline that guesses silently is the failure mode.
- **\`mg/mL\` versus \`g/L\`** are numerically equal for this quantity, so the values look fine either way.
  The label changed; the numbers did not. Assuming a conversion is needed is as wrong as assuming one is
  not — you have to check what the quantity actually is.

</details>

## Simplifications

These files are messy in the ways that are teachable. Real exports are also messy in ways that are only
tedious: truncated final rows, embedded newlines inside quoted fields, mixed encodings within one file,
and columns that change meaning halfway through a year. None of those are here.
`;
writeFileSync(join(rawDir, 'README.md'), rawReadme);

/* ------------------------------------------------------------------ */
/* 9. SQLite                                                           */
/* ------------------------------------------------------------------ */

const sql = [
  'PRAGMA journal_mode = OFF;',
  'BEGIN;',
  toSql('batches', BATCH_COLS, batchRows),
  toSql('sensors', SENSOR_COLS, sensorRows),
  toSql('spectra', SPECTRA_COLS, spectraRows),
  'COMMIT;',
].join('\n');
const sqliteBin = existsSync('/usr/bin/sqlite3') ? '/usr/bin/sqlite3' : 'sqlite3';
const dbPath = join(OUT, 'manufacturing.sqlite');
if (existsSync(dbPath)) rmSync(dbPath);
const res = spawnSync(sqliteBin, [dbPath], { input: sql, encoding: 'utf8' });
if (res.status !== 0) console.warn(`sqlite3 not available or failed — manufacturing.sqlite not built. ${res.stderr ?? ''}`);

console.log(
  `manufacturing: ${batchRows.length} batches, ${sensorRows.length} sensor readings, ${spectraRows.length} spectra, ` +
    `${quarterKeys.length} messy raw exports (${rawRowsWritten} rows) `  +
    `(${nReleased} released / ${nInvestigation} investigation / ${nRejected} rejected; ` +
    `mean potency ${round(mean(potencies), 1)}%, mean titer ${round(mean(titers), 2)} g/L).`,
);

/* ------------------------------------------------------------------ */
/* 10. Verification (R)                                                */
/* ------------------------------------------------------------------ */

// Every teaching property these datasets rely on — recomputable summaries, a reconcilable set of messy
// exports, the planted excursions, the leakage gap — is asserted by verify.R. Running it here means a
// change that quietly breaks one of them fails the generator rather than reaching a learner.
const rCheck = spawnSync('Rscript', ['--version'], { encoding: 'utf8' });
if (rCheck.status === 0) {
  const v = spawnSync('Rscript', [join(here, 'verify.R'), join('data', 'manufacturing')], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (v.status !== 0) {
    console.error(v.stdout ?? '');
    console.error('manufacturing: verify.R FAILED — the generated data no longer match the documentation.');
    process.exitCode = 1;
  } else {
    console.log(`manufacturing: ${(v.stdout ?? '').trim().split('\n').pop()}`);
  }
} else {
  console.warn('Rscript not found — skipped verify.R (run it manually to check the generated data).');
}
