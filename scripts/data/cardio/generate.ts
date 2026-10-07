/**
 * VTX221-201 — synthetic 12-week antihypertensive trial (fictional sponsor: Halden Therapeutics).
 *
 * Deterministic generator: the same SEED produces byte-identical CSV files. Node built-ins only.
 *
 *   npx tsx scripts/data/cardio/generate.ts
 *
 * Writes to data/cardio/:
 *   adsl.csv, advs.csv, ae.csv   teaching datasets (ADaM-like ADSL/ADVS, SDTM-like AE)
 *   manifest.json                validated by DatasetManifestSchema (src/content/schema.ts)
 *   README.md                    design, derivation rules, simplifications
 *   cardio.sqlite                tables adsl, advs, ae (built with the sqlite3 CLI when available)
 *   FACTS.md                     key results computed in R by scripts/data/cardio/facts.R (when Rscript is available)
 *
 * Everything is fictional: no real patients, sites, sponsor or product.
 *
 * Simulation model (the "truth" behind the data) — see README.md for the learner-facing version:
 *   latent subject mean SBP  mu_i = 146 + 0.18(age-56) + 0.30(BMI-30) + 1.5*diabetes + N(0, 9.5^2)
 *   visit value              mu_i + g(week) * (delta_arm + r_i) + e_i(t)            (mmHg)
 *     g(week)   = smooth onset reaching 1 at week 12 (≈0.6 at week 2, ≈0.84 at week 4)
 *     delta     = -3.0 placebo, -8.5 VTX-221 10 mg, -11.5 VTX-221 20 mg (+2.0 in diabetics on active drug)
 *     r_i       ~ N(0, 5.5^2) individual response
 *     e_i(t)    = continuous-time AR(1) with SD 6.5 and correlation exp(-|dt|/3 weeks)
 *   each visit value is the mean of three seated readings (reading SD 4 mmHg), rounded to 0.1.
 *   Dropout is MAR: lack-of-efficacy discontinuation depends on the last OBSERVED SBP.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..', '..');
const OUT = join(ROOT, 'data', 'cardio');

const SEED = 44;
const STUDYID = 'VTX221-201';
const N_RAND = 270;
const FIRST_RAND = '2024-03-04';

/* ------------------------------------------------------------------ */
/* Seeded PRNG (splitmix32 seeding + sfc32)                             */
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
  /** Uniform on [0, 1). */
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
  bern(p: number): boolean {
    return this.next() < p;
  }
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)];
  }
  weighted<T>(xs: readonly T[], w: readonly number[]): T {
    const total = w.reduce((s, x) => s + x, 0);
    let u = this.next() * total;
    for (let i = 0; i < xs.length; i++) {
      u -= w[i];
      if (u < 0) return xs[i];
    }
    return xs[xs.length - 1];
  }
  shuffle<T>(xs: T[]): T[] {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    return xs;
  }
}

// Independent streams, so tuning one part of the simulation does not reshuffle the others.
const rngSubj = new Rng(SEED);
const rngBP = new Rng(SEED + 101);
const rngRand = new Rng(SEED + 202);
const rngDrop = new Rng(SEED + 303);
const rngAE = new Rng(SEED + 404);

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;
const logistic = (x: number) => 1 / (1 + Math.exp(-x));
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

const DAY_MS = 86_400_000;
const toDayNum = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;
const toIso = (dn: number) => new Date(dn * DAY_MS).toISOString().slice(0, 10);
const weekday = (dn: number) => new Date(dn * DAY_MS).getUTCDay(); // 0 = Sunday

/** Calendar date of study day `d` (Day 1 = reference date; there is no Day 0). */
const dateOfDay = (ref: number, d: number) => (d >= 1 ? ref + d - 1 : ref + d);

/* ------------------------------------------------------------------ */
/* Design constants                                                     */
/* ------------------------------------------------------------------ */

const ARMS = ['Placebo', 'VTX-221 10 mg', 'VTX-221 20 mg'] as const;
type ArmN = 0 | 1 | 2;

const SITES = [
  { id: '101', country: 'USA', w: 1.4 },
  { id: '102', country: 'USA', w: 1.0 },
  { id: '103', country: 'USA', w: 1.2 },
  { id: '104', country: 'USA', w: 0.8 },
  { id: '105', country: 'USA', w: 1.1 },
  { id: '106', country: 'USA', w: 0.9 },
  { id: '107', country: 'USA', w: 1.3 },
  { id: '108', country: 'USA', w: 0.7 },
  { id: '109', country: 'USA', w: 1.0 },
  { id: '110', country: 'CAN', w: 0.9 },
  { id: '111', country: 'CAN', w: 0.8 },
  { id: '112', country: 'CAN', w: 0.9 },
];

const SCHED = [
  { visit: 'WEEK 2', visitnum: 3, target: 15, sd: 1.2, lo: 12, hi: 18 },
  { visit: 'WEEK 4', visitnum: 4, target: 29, sd: 1.5, lo: 26, hi: 32 },
  { visit: 'WEEK 8', visitnum: 5, target: 57, sd: 2.0, lo: 53, hi: 61 },
  { visit: 'WEEK 12', visitnum: 6, target: 85, sd: 2.0, lo: 81, hi: 89 },
] as const;

/** Analysis windows on ADY for post-baseline analysis visits. */
const WINDOWS = [
  { avisit: 'WEEK 2', avisitn: 2, lo: 2, hi: 21, target: 15 },
  { avisit: 'WEEK 4', avisitn: 4, lo: 22, hi: 42, target: 29 },
  { avisit: 'WEEK 8', avisitn: 8, lo: 43, hi: 70, target: 57 },
  { avisit: 'WEEK 12', avisitn: 12, lo: 71, hi: 99, target: 85 },
] as const;

// Blood-pressure model parameters (mmHg). See header comment.
const P = {
  muS: 146,
  sdMuS: 9.5,
  sigES: 6.5,
  readSdS: 4,
  sdRS: 5.5,
  deltaS: [-3.0, -8.5, -11.5],
  diabShiftS: 2.0,
  muD: 89,
  sdMuD: 6,
  sigED: 4.5,
  readSdD: 3,
  deltaD: [-1.5, -4.5, -6.5],
  diabShiftD: 1.0,
  tauWeeks: 3,
  onsetWeeks: 2.2,
};

/* ------------------------------------------------------------------ */
/* Subjects                                                             */
/* ------------------------------------------------------------------ */

interface Meas {
  day: number;
  visit: string;
  visitnum: number;
  sbp: number;
  dbp: number;
}

interface Subject {
  age: number;
  sex: 'M' | 'F';
  race: string;
  ethnic: string;
  height: number;
  weight: number;
  bmi: number;
  diab: boolean;
  muS: number;
  muD: number;
  rS: number;
  rD: number;
  zS: number;
  zD: number;
  tLast: number;
  deltaS: number;
  deltaD: number;
  meas: Meas[];
  // assigned later
  site: string;
  country: string;
  subjid: string;
  usubjid: string;
  randDay: number;
  randno: number;
  arm: ArmN;
  stratIxrs: 1 | 2;
  neverDosed: boolean;
  discReason: string | null;
  discDay: number | null;
  trtEndDay: number | null;
  eosDay: number;
  complPct: number | null;
}

const g = (week: number) => (week <= 0 ? 0 : (1 - Math.exp(-week / P.onsetWeeks)) / (1 - Math.exp(-12 / P.onsetWeeks)));

/** Measure seated BP on study day `day` (mean of 3 readings). Advances the subject's AR(1) state. */
function measure(s: Subject, day: number): { sbp: number; dbp: number } {
  const week = day >= 1 ? (day - 1) / 7 : day / 7;
  const rho = Math.exp(-Math.max(0, week - s.tLast) / P.tauWeeks);
  const k = Math.sqrt(1 - rho * rho);
  s.zS = rho * s.zS + k * rngBP.normal();
  s.zD = rho * s.zD + k * rngBP.normal();
  s.tLast = week;
  const eS = P.sigES * s.zS;
  const eD = P.sigED * (0.55 * s.zS + Math.sqrt(1 - 0.55 * 0.55) * s.zD);
  const gg = g(week);
  const latS = s.muS + gg * (s.deltaS + s.rS) + eS;
  const latD = s.muD + gg * (s.deltaD + s.rD) + eD;
  const rs = [0, 1, 2].map(() => Math.round(latS + rngBP.normal(0, P.readSdS)));
  const rd = [0, 1, 2].map(() => Math.round(latD + rngBP.normal(0, P.readSdD)));
  return { sbp: round1(mean(rs)), dbp: round1(mean(rd)) };
}

const RACES = ['WHITE', 'BLACK OR AFRICAN AMERICAN', 'ASIAN', 'AMERICAN INDIAN OR ALASKA NATIVE', 'MULTIPLE'];
const RACE_W = [0.66, 0.22, 0.08, 0.02, 0.02];
const ETHNICS = ['HISPANIC OR LATINO', 'NOT HISPANIC OR LATINO', 'NOT REPORTED'];
const ETHNIC_W = [0.16, 0.83, 0.01];

let screened = 0;
let sfBp = 0;
let sfOther = 0;
const subjects: Subject[] = [];
while (subjects.length < N_RAND) {
  screened++;
  const age = clamp(Math.round(rngSubj.normal(56, 10.5)), 30, 80);
  const sex: 'M' | 'F' = rngSubj.bern(0.46) ? 'F' : 'M';
  const race = rngSubj.weighted(RACES, RACE_W);
  const ethnic = rngSubj.weighted(ETHNICS, ETHNIC_W);
  const height = Math.round(sex === 'M' ? rngSubj.normal(176, 7) : rngSubj.normal(162.5, 6.5));
  const bmiTarget = clamp(rngSubj.normal(30.2, 4.8), 19, 46);
  const weight = round1(bmiTarget * (height / 100) ** 2);
  const bmi = round1(weight / (height / 100) ** 2);
  const diab = rngSubj.bern(logistic(-1.45 + 0.09 * (bmi - 30) + 0.03 * (age - 56)));
  const muS = P.muS + 0.18 * (age - 56) + 0.3 * (bmi - 30) + (diab ? 1.5 : 0) + rngSubj.normal(0, P.sdMuS);
  const muD = P.muD - 0.22 * (age - 56) + 0.3 * (muS - P.muS) + rngSubj.normal(0, P.sdMuD);
  const rS = rngSubj.normal(0, P.sdRS);
  const rD = 0.45 * rS + rngSubj.normal(0, 2.5);
  const scrDay = -rngSubj.int(7, 14);
  const s: Subject = {
    age, sex, race, ethnic, height, weight, bmi, diab, muS, muD, rS, rD,
    zS: rngBP.normal(), zD: rngBP.normal(), tLast: scrDay / 7, deltaS: 0, deltaD: 0, meas: [],
    site: '', country: '', subjid: '', usubjid: '', randDay: 0, randno: 0, arm: 0, stratIxrs: 1,
    neverDosed: false, discReason: null, discDay: null, trtEndDay: null, eosDay: 0, complPct: null,
  };
  const scr = measure(s, scrDay);
  const other = rngSubj.bern(0.1);
  if (scr.sbp < 140 || scr.sbp >= 180 || scr.dbp >= 110) {
    sfBp++;
    continue;
  }
  if (other) {
    sfOther++;
    continue;
  }
  const bl = measure(s, 1);
  if (bl.sbp < 130 || bl.sbp >= 180) {
    sfBp++;
    continue;
  }
  s.meas.push({ day: scrDay, visit: 'SCREENING', visitnum: 1, ...scr });
  s.meas.push({ day: 1, visit: 'BASELINE', visitnum: 2, ...bl });
  subjects.push(s);
}

/* Sites, randomization dates and subject identifiers ---------------- */

const firstRand = toDayNum(FIRST_RAND);
const randDays = subjects
  .map(() => {
    let d = firstRand + Math.floor(rngRand.next() * 285);
    const wd = weekday(d);
    if (wd === 6) d += 2; // Saturday → Monday
    if (wd === 0) d += 1; // Sunday → Monday
    return d;
  })
  .sort((a, b) => a - b);
subjects.forEach((s, i) => {
  s.randDay = randDays[i];
  const site = rngRand.weighted(SITES, SITES.map((x) => x.w));
  s.site = site.id;
  s.country = site.country;
});
const perSite = new Map<string, number>();
for (const s of subjects) {
  const n = (perSite.get(s.site) ?? 0) + 1;
  perSite.set(s.site, n);
  s.subjid = `${s.site}-${String(n).padStart(3, '0')}`;
  s.usubjid = `${STUDYID}-${s.subjid}`;
}

/* Stratified permuted-block randomization (block size 6, 1:1:1) ------ */

const baseSbp = (s: Subject) => s.meas[1].sbp;
for (const s of subjects) s.stratIxrs = baseSbp(s) < 150 ? 1 : 2;
// Three stratification errors: the value keyed into IxRS was mistyped for subjects close to the cut-off.
const nearCut = subjects.filter((s) => Math.abs(baseSbp(s) - 150) <= 3);
for (const s of rngRand.shuffle([...nearCut]).slice(0, 3)) s.stratIxrs = s.stratIxrs === 1 ? 2 : 1;

const queues: Record<number, ArmN[]> = { 1: [], 2: [] };
const seqInStratum: Record<number, number> = { 1: 0, 2: 0 };
for (const s of subjects) {
  const q = queues[s.stratIxrs];
  if (q.length === 0) q.push(...rngRand.shuffle<ArmN>([0, 0, 1, 1, 2, 2]));
  s.arm = q.shift() as ArmN;
  seqInStratum[s.stratIxrs]++;
  s.randno = s.stratIxrs * 1000 + seqInStratum[s.stratIxrs];
  const shiftS = s.diab && s.arm > 0 ? P.diabShiftS : 0;
  const shiftD = s.diab && s.arm > 0 ? P.diabShiftD : 0;
  s.deltaS = P.deltaS[s.arm] + shiftS;
  s.deltaD = P.deltaD[s.arm] + shiftD;
}

// Two subjects withdraw consent on Day 1 after randomization, before the first dose.
for (const s of rngRand.shuffle([...subjects]).slice(0, 2)) s.neverDosed = true;

/* ------------------------------------------------------------------ */
/* On-treatment period: visits, dropout (MAR), unscheduled / ET visits  */
/* ------------------------------------------------------------------ */

const REASONS = ['WITHDRAWAL BY SUBJECT', 'LOST TO FOLLOW-UP', 'PHYSICIAN DECISION', 'ADVERSE EVENT', 'LACK OF EFFICACY'] as const;
const P_AE_DROP = [0.002, 0.005, 0.009];

for (const s of subjects) {
  if (s.neverDosed) {
    s.discReason = 'WITHDRAWAL BY SUBJECT';
    s.discDay = 1;
    s.eosDay = 1;
    continue;
  }
  let prevDay = 1;
  let prevVisitnum = 2;
  let lastSbp = baseSbp(s);
  let lastAttended = 1;
  let completed = false;
  for (let k = 0; k < SCHED.length; k++) {
    const v = SCHED[k];
    const day = clamp(Math.round(v.target + rngDrop.normal(0, v.sd)), v.lo, v.hi);
    const probs = [0.004, 0.003, 0.0015, P_AE_DROP[s.arm], k === 0 ? 0 : logistic(-4.3 + 0.15 * (lastSbp - 150))];
    let u = rngDrop.next();
    let reason: string | null = null;
    for (let r = 0; r < probs.length; r++) {
      u -= probs[r];
      if (u < 0) {
        reason = REASONS[r];
        break;
      }
    }
    if (reason) {
      const span = Math.max(1, day - prevDay - 3);
      const dDay = prevDay + 2 + Math.floor(rngDrop.next() * span);
      s.discReason = reason;
      if (reason === 'LOST TO FOLLOW-UP') {
        s.discDay = lastAttended;
        s.trtEndDay = lastAttended;
        s.eosDay = lastAttended;
      } else {
        s.discDay = dDay;
        s.trtEndDay = dDay;
        s.eosDay = dDay;
        if (rngDrop.bern(0.75)) {
          const m = measure(s, dDay);
          s.meas.push({ day: dDay, visit: 'EARLY TERMINATION', visitnum: 99, ...m });
        }
      }
      break;
    }
    // Occasional unscheduled BP re-check between visits.
    if (rngDrop.bern(0.015) && day - prevDay > 5) {
      const uDay = prevDay + 2 + Math.floor(rngDrop.next() * (day - prevDay - 4));
      const m = measure(s, uDay);
      s.meas.push({ day: uDay, visit: 'UNSCHEDULED', visitnum: round2(prevVisitnum + 0.01), ...m });
      lastSbp = m.sbp;
      lastAttended = uDay;
    }
    // Intermittently missed visit (the subject stays in the study).
    if (k < SCHED.length - 1 && rngDrop.bern(0.025)) {
      prevDay = day;
      prevVisitnum = v.visitnum;
      continue;
    }
    const m = measure(s, day);
    s.meas.push({ day, visit: v.visit, visitnum: v.visitnum, ...m });
    lastSbp = m.sbp;
    lastAttended = day;
    prevDay = day;
    prevVisitnum = v.visitnum;
    if (k === SCHED.length - 1) completed = true;
  }
  if (completed) {
    const w12 = s.meas[s.meas.length - 1].day;
    s.trtEndDay = w12 - 1; // Week 12 is a trough visit: the last dose is taken the day before.
    s.eosDay = w12;
  }
  const lowCompliance = rngDrop.bern(0.035);
  s.complPct = round1(clamp(lowCompliance ? rngDrop.normal(72, 6) : rngDrop.normal(96.5, 4.5), 55, 108));
}

/* ------------------------------------------------------------------ */
/* Adverse events (SDTM-like AE)                                        */
/* ------------------------------------------------------------------ */

interface AeTerm {
  pt: string;
  soc: string;
  inc: [number, number, number];
  early?: boolean;
  related: boolean;
  dur: number;
  verbatim: string[];
}

const AE_TERMS: AeTerm[] = [
  { pt: 'Dizziness', soc: 'Nervous system disorders', inc: [0.04, 0.08, 0.12], early: true, related: true, dur: 4, verbatim: ['Dizziness', 'Dizzy', 'Light-headedness', 'DIZZINESS', 'Intermittent dizziness'] },
  { pt: 'Headache', soc: 'Nervous system disorders', inc: [0.09, 0.07, 0.06], related: false, dur: 2, verbatim: ['Headache', 'headache', 'Head ache', 'HEADACHE', 'Tension headache'] },
  { pt: 'Hypotension', soc: 'Vascular disorders', inc: [0.0, 0.02, 0.05], early: true, related: true, dur: 3, verbatim: ['Hypotension', 'Low blood pressure', 'BP low'] },
  { pt: 'Orthostatic hypotension', soc: 'Vascular disorders', inc: [0.0, 0.01, 0.03], early: true, related: true, dur: 5, verbatim: ['Orthostatic hypotension', 'Postural hypotension'] },
  { pt: 'Edema peripheral', soc: 'General disorders and administration site conditions', inc: [0.01, 0.03, 0.07], related: true, dur: 14, verbatim: ['Ankle swelling', 'Peripheral edema', 'Swollen ankles', 'Leg edema'] },
  { pt: 'Fatigue', soc: 'General disorders and administration site conditions', inc: [0.03, 0.04, 0.06], related: true, dur: 7, verbatim: ['Fatigue', 'Tiredness', 'tired'] },
  { pt: 'Nasopharyngitis', soc: 'Infections and infestations', inc: [0.05, 0.05, 0.05], related: false, dur: 6, verbatim: ['Common cold', 'Nasopharyngitis', 'Cold'] },
  { pt: 'Upper respiratory tract infection', soc: 'Infections and infestations', inc: [0.04, 0.03, 0.04], related: false, dur: 7, verbatim: ['URI', 'Upper respiratory infection', 'Upper respiratory tract infection'] },
  { pt: 'Nausea', soc: 'Gastrointestinal disorders', inc: [0.02, 0.03, 0.03], related: false, dur: 2, verbatim: ['Nausea', 'Nauseous'] },
  { pt: 'Cough', soc: 'Respiratory, thoracic and mediastinal disorders', inc: [0.02, 0.02, 0.03], related: false, dur: 8, verbatim: ['Cough', 'Dry cough'] },
  { pt: 'Back pain', soc: 'Musculoskeletal and connective tissue disorders', inc: [0.03, 0.02, 0.03], related: false, dur: 5, verbatim: ['Back pain', 'Lower back pain'] },
  { pt: 'Hyperkalemia', soc: 'Metabolism and nutrition disorders', inc: [0.0, 0.01, 0.03], related: true, dur: 10, verbatim: ['Hyperkalemia', 'Hyperkalaemia', 'High potassium'] },
  { pt: 'Hypertension', soc: 'Vascular disorders', inc: [0.03, 0.01, 0.0], related: false, dur: 6, verbatim: ['Worsening hypertension', 'Hypertension', 'Elevated blood pressure'] },
  { pt: 'Syncope', soc: 'Nervous system disorders', inc: [0.0, 0.0, 0.015], early: true, related: true, dur: 1, verbatim: ['Syncope', 'Fainting episode'] },
];
const byPt = new Map(AE_TERMS.map((t) => [t.pt, t]));

interface AeRec {
  s: Subject;
  term: AeTerm;
  verbatim: string;
  start: number;
  end: number | null;
  sev: string;
  ser: 'Y' | 'N';
  rel: string;
  acn: string;
  out: string;
  epoch: string;
}

const aes: AeRec[] = [];

function makeAe(s: Subject, term: AeTerm, start: number, opts: { withdrawn?: boolean; pre?: boolean } = {}): AeRec {
  const dur = Math.max(1, Math.round(-Math.log(1 - rngAE.next()) * term.dur));
  let end: number | null = start + dur - 1;
  if (start < 1 && end >= 1) end = start + Math.max(0, -start - 1); // pre-treatment AEs resolve before Day 1 here
  if (end > s.eosDay) end = null; // ongoing at the end of the subject's participation
  let sev = rngAE.weighted(['MILD', 'MODERATE', 'SEVERE'], [0.62, 0.32, 0.06]);
  if (term.pt === 'Syncope') sev = rngAE.bern(0.5) ? 'MODERATE' : 'SEVERE';
  if (opts.withdrawn && sev === 'MILD') sev = 'MODERATE';
  let ser: 'Y' | 'N' = rngAE.bern(0.005) ? 'Y' : 'N';
  if (term.pt === 'Syncope') ser = 'Y';
  if (term.pt === 'Hypertension' && rngAE.bern(0.2)) ser = 'Y';
  const pRel = term.related ? (s.arm > 0 ? 0.65 : 0.35) : 0.08;
  const rel = opts.pre ? 'NOT RELATED' : rngAE.bern(opts.withdrawn ? 0.9 : pRel) ? 'RELATED' : 'NOT RELATED';
  let acn = 'DOSE NOT CHANGED';
  if (opts.pre) acn = 'NOT APPLICABLE';
  else if (opts.withdrawn) acn = 'DRUG WITHDRAWN';
  else if (sev === 'SEVERE' || rngAE.bern(0.06)) acn = 'DRUG INTERRUPTED';
  return {
    s, term, verbatim: rngAE.pick(term.verbatim), start, end, sev, ser, rel, acn,
    out: end === null ? 'NOT RECOVERED/NOT RESOLVED' : 'RECOVERED/RESOLVED',
    epoch: start < 1 ? 'SCREENING' : 'TREATMENT',
  };
}

for (const s of subjects) {
  if (s.neverDosed) continue;
  const lastDay = s.trtEndDay ?? 1;
  const scrDay = s.meas[0].day;
  if (rngAE.bern(0.02)) {
    const t = byPt.get(rngAE.pick(['Nasopharyngitis', 'Headache', 'Back pain']))!;
    aes.push(makeAe(s, t, rngAE.int(scrDay + 1, -1), { pre: true }));
  }
  for (const t of AE_TERMS) {
    if (!rngAE.bern(t.inc[s.arm])) continue;
    const early = t.early && rngAE.bern(0.7);
    const start = early ? rngAE.int(1, Math.min(14, lastDay)) : rngAE.int(1, lastDay);
    aes.push(makeAe(s, t, start));
    if ((t.pt === 'Headache' || t.pt === 'Dizziness') && rngAE.bern(0.15) && start + 10 < lastDay) {
      aes.push(makeAe(s, t, rngAE.int(start + 10, lastDay)));
    }
  }
  if (s.discReason === 'ADVERSE EVENT' && s.discDay !== null) {
    const pts = s.arm === 0 ? ['Headache', 'Dizziness', 'Hypertension'] : ['Dizziness', 'Hypotension', 'Edema peripheral', 'Fatigue'];
    const t = byPt.get(rngAE.pick(pts))!;
    aes.push(makeAe(s, t, Math.max(2, s.discDay - rngAE.int(0, 4)), { withdrawn: true }));
  }
}

/* ------------------------------------------------------------------ */
/* Dataset assembly                                                     */
/* ------------------------------------------------------------------ */

type Val = string | number | null;
type Row = Record<string, Val>;

interface Col {
  name: string;
  label: string;
  type: 'char' | 'num' | 'date';
  role?: string;
  origin?: string;
  codelist?: string;
  derivation?: string;
  notes?: string;
  dec?: number;
}

const refDay = (s: Subject) => s.randDay; // Day 1 = first dose = randomization date (never-dosed: randomization date)
const iso = (s: Subject, d: number | null) => (d === null ? null : toIso(dateOfDay(refDay(s), d)));

/* ---------------- ADSL ---------------- */

const ADSL_COLS: Col[] = [
  { name: 'STUDYID', label: 'Study Identifier', type: 'char', role: 'Identifier', origin: 'Assigned' },
  { name: 'USUBJID', label: 'Unique Subject Identifier', type: 'char', role: 'Identifier', origin: 'Assigned', derivation: 'STUDYID || "-" || SUBJID.' },
  { name: 'SUBJID', label: 'Subject Identifier for the Study', type: 'char', role: 'Identifier', origin: 'Assigned', derivation: 'SITEID || "-" || three-digit sequence number within site (in order of randomization).' },
  { name: 'SITEID', label: 'Study Site Identifier', type: 'char', role: 'Identifier', origin: 'Assigned', notes: '12 fictional sites: 101–109 in the USA, 110–112 in Canada.' },
  { name: 'COUNTRY', label: 'Country', type: 'char', role: 'Demographic', origin: 'Assigned', codelist: 'ISO 3166-1 alpha-3' },
  { name: 'AGE', label: 'Age', type: 'num', role: 'Demographic', origin: 'Collected', dec: 0, notes: 'Age in years at informed consent (inclusion: 30–80 years in this simulation).' },
  { name: 'AGEU', label: 'Age Units', type: 'char', role: 'Demographic', origin: 'Assigned', codelist: 'AGEU' },
  { name: 'AGEGR1', label: 'Pooled Age Group 1', type: 'char', role: 'Subgroup', origin: 'Derived', derivation: '"<65" if AGE < 65; ">=65" if AGE >= 65.' },
  { name: 'AGEGR1N', label: 'Pooled Age Group 1 (N)', type: 'num', role: 'Subgroup', origin: 'Derived', dec: 0, derivation: '1 if AGEGR1 = "<65"; 2 if AGEGR1 = ">=65".' },
  { name: 'SEX', label: 'Sex', type: 'char', role: 'Demographic', origin: 'Collected', codelist: 'SEX (M, F)' },
  { name: 'RACE', label: 'Race', type: 'char', role: 'Demographic', origin: 'Collected', codelist: 'Classic SDTM RACE values', notes: 'Race/ethnicity terminology has been evolving in recent CDISC CT releases (RACEC/ETHNICC "as collected" codelists); the classic submission values are used here.' },
  { name: 'ETHNIC', label: 'Ethnicity', type: 'char', role: 'Demographic', origin: 'Collected', codelist: 'Classic SDTM ETHNIC values' },
  { name: 'HEIGHTBL', label: 'Baseline Height (cm)', type: 'num', role: 'Baseline characteristic', origin: 'Collected', dec: 0, notes: 'Measured at screening.' },
  { name: 'WEIGHTBL', label: 'Baseline Weight (kg)', type: 'num', role: 'Baseline characteristic', origin: 'Collected', dec: 1, notes: 'Measured at screening.' },
  { name: 'BMIBL', label: 'Baseline BMI (kg/m2)', type: 'num', role: 'Baseline characteristic', origin: 'Derived', dec: 1, derivation: 'WEIGHTBL / (HEIGHTBL/100)**2, rounded to 1 decimal.' },
  { name: 'DIABFL', label: 'Type 2 Diabetes at Baseline Flag', type: 'char', role: 'Baseline characteristic', origin: 'Derived', codelist: 'NY (Y, N)', derivation: '"Y" if the medical history records type 2 diabetes mellitus at screening, else "N" (medical history not included in this teaching dataset).' },
  { name: 'SBPBL', label: 'Baseline Seated Systolic BP (mmHg)', type: 'num', role: 'Baseline characteristic', origin: 'Derived', dec: 1, derivation: 'ADVS.AVAL where PARAMCD = "SYSBP" and ABLFL = "Y" (Day 1 pre-dose value, mean of 3 seated readings).' },
  { name: 'DBPBL', label: 'Baseline Seated Diastolic BP (mmHg)', type: 'num', role: 'Baseline characteristic', origin: 'Derived', dec: 1, derivation: 'ADVS.AVAL where PARAMCD = "DIABP" and ABLFL = "Y".' },
  { name: 'SBPGR1', label: 'Baseline SBP Group 1', type: 'char', role: 'Subgroup', origin: 'Derived', derivation: '"<150 mmHg" if SBPBL < 150; ">=150 mmHg" otherwise. Derived from the analysis baseline — compare with STRAT1R (stratum as randomized).' },
  { name: 'SBPGR1N', label: 'Baseline SBP Group 1 (N)', type: 'num', role: 'Subgroup', origin: 'Derived', dec: 0, derivation: '1 if SBPGR1 = "<150 mmHg"; 2 otherwise.' },
  { name: 'STRAT1R', label: 'Stratum 1 as Randomized', type: 'char', role: 'Stratification', origin: 'Assigned', derivation: 'Baseline SBP stratum recorded in the IxRS at randomization ("<150 mmHg" / ">=150 mmHg"). Three subjects were stratified in error (STRAT1R differs from SBPGR1).' },
  { name: 'STRAT1RN', label: 'Stratum 1 as Randomized (N)', type: 'num', role: 'Stratification', origin: 'Derived', dec: 0, derivation: '1 if STRAT1R = "<150 mmHg"; 2 otherwise.' },
  { name: 'RANDNO', label: 'Randomization Number', type: 'num', role: 'Identifier', origin: 'Assigned', dec: 0, derivation: 'Stratum number × 1000 + sequence within stratum (from the IxRS randomization list).' },
  { name: 'TRT01P', label: 'Planned Treatment for Period 01', type: 'char', role: 'Treatment', origin: 'Assigned', derivation: 'Treatment assigned by the IxRS: "Placebo", "VTX-221 10 mg" or "VTX-221 20 mg" (permuted blocks of 6 within stratum, 1:1:1).' },
  { name: 'TRT01PN', label: 'Planned Treatment for Period 01 (N)', type: 'num', role: 'Treatment', origin: 'Derived', dec: 0, derivation: '0 = Placebo, 1 = VTX-221 10 mg, 2 = VTX-221 20 mg.' },
  { name: 'TRT01A', label: 'Actual Treatment for Period 01', type: 'char', role: 'Treatment', origin: 'Derived', derivation: 'Equal to TRT01P for treated subjects (no dispensing errors occurred); missing for subjects never dosed.' },
  { name: 'TRT01AN', label: 'Actual Treatment for Period 01 (N)', type: 'num', role: 'Treatment', origin: 'Derived', dec: 0, derivation: 'Numeric code of TRT01A.' },
  { name: 'RANDDT', label: 'Date of Randomization', type: 'date', role: 'Timing', origin: 'Collected', notes: 'ISO 8601 text in the CSV; a SAS dataset would store a numeric date with a DATE9. format.' },
  { name: 'TRTSDT', label: 'Date of First Exposure to Treatment', type: 'date', role: 'Timing', origin: 'Derived', derivation: 'Date of first dose. First dose is taken on Day 1, the randomization day. Missing if never dosed.' },
  { name: 'TRTEDT', label: 'Date of Last Exposure to Treatment', type: 'date', role: 'Timing', origin: 'Derived', derivation: 'Date of last dose (dosing diary). Completers: the day before the Week 12 trough visit. Missing if never dosed.' },
  { name: 'TRTDURD', label: 'Total Treatment Duration (Days)', type: 'num', role: 'Timing', origin: 'Derived', dec: 0, derivation: 'TRTEDT − TRTSDT + 1.' },
  { name: 'COMPLPCT', label: 'Treatment Compliance (%)', type: 'num', role: 'Compliance', origin: 'Derived', dec: 1, derivation: '100 × tablets taken / tablets expected over the treatment period, from drug accountability (accountability records are not included — simplification).' },
  { name: 'EOSSTT', label: 'End of Study Status', type: 'char', role: 'Disposition', origin: 'Derived', derivation: '"COMPLETED" if the subject attended the Week 12 visit; otherwise "DISCONTINUED".' },
  { name: 'EOSDT', label: 'End of Study Date', type: 'date', role: 'Timing', origin: 'Derived', derivation: 'Completers: Week 12 visit date. Discontinued: early-termination date, or last visit date for subjects lost to follow-up.' },
  { name: 'DCSREAS', label: 'Reason for Discontinuation from Study', type: 'char', role: 'Disposition', origin: 'Collected', codelist: 'NCOMPLT', derivation: 'Primary reason recorded on the disposition CRF; missing for completers.' },
  { name: 'ITTFL', label: 'Intent-To-Treat Population Flag', type: 'char', role: 'Population flag', origin: 'Derived', codelist: 'NY', derivation: '"Y" for every randomized subject (analyzed as randomized).' },
  { name: 'SAFFL', label: 'Safety Population Flag', type: 'char', role: 'Population flag', origin: 'Derived', codelist: 'NY', derivation: '"Y" if the subject took at least one dose of study drug (TRTSDT not missing).' },
  { name: 'PPROTFL', label: 'Per-Protocol Population Flag', type: 'char', role: 'Population flag', origin: 'Derived', codelist: 'NY', derivation: '"Y" if ITTFL = "Y", SAFFL = "Y", COMPLFL = "Y" and 80 <= COMPLPCT <= 120 (SAP rule for this teaching study).' },
  { name: 'COMPLFL', label: 'Completers Population Flag', type: 'char', role: 'Population flag', origin: 'Derived', codelist: 'NY', derivation: '"Y" if EOSSTT = "COMPLETED" (Week 12 visit attended).' },
];

const armCode = (s: Subject): ArmN => s.arm;
const adsl: Row[] = subjects
  .slice()
  .sort((a, b) => (a.usubjid < b.usubjid ? -1 : 1))
  .map((s) => {
    const sbpbl = baseSbp(s);
    const completed = s.discReason === null;
    const trts = s.neverDosed ? null : 1;
    const perProt = !s.neverDosed && completed && s.complPct !== null && s.complPct >= 80 && s.complPct <= 120;
    return {
      STUDYID: STUDYID,
      USUBJID: s.usubjid,
      SUBJID: s.subjid,
      SITEID: s.site,
      COUNTRY: s.country,
      AGE: s.age,
      AGEU: 'YEARS',
      AGEGR1: s.age < 65 ? '<65' : '>=65',
      AGEGR1N: s.age < 65 ? 1 : 2,
      SEX: s.sex,
      RACE: s.race,
      ETHNIC: s.ethnic,
      HEIGHTBL: s.height,
      WEIGHTBL: s.weight,
      BMIBL: s.bmi,
      DIABFL: s.diab ? 'Y' : 'N',
      SBPBL: sbpbl,
      DBPBL: s.meas[1].dbp,
      SBPGR1: sbpbl < 150 ? '<150 mmHg' : '>=150 mmHg',
      SBPGR1N: sbpbl < 150 ? 1 : 2,
      STRAT1R: s.stratIxrs === 1 ? '<150 mmHg' : '>=150 mmHg',
      STRAT1RN: s.stratIxrs,
      RANDNO: s.randno,
      TRT01P: ARMS[armCode(s)],
      TRT01PN: armCode(s),
      TRT01A: s.neverDosed ? null : ARMS[armCode(s)],
      TRT01AN: s.neverDosed ? null : armCode(s),
      RANDDT: toIso(s.randDay),
      TRTSDT: iso(s, trts),
      TRTEDT: iso(s, s.trtEndDay),
      TRTDURD: s.trtEndDay === null ? null : s.trtEndDay,
      COMPLPCT: s.complPct,
      EOSSTT: completed ? 'COMPLETED' : 'DISCONTINUED',
      EOSDT: iso(s, s.eosDay),
      DCSREAS: s.discReason,
      ITTFL: 'Y',
      SAFFL: s.neverDosed ? 'N' : 'Y',
      PPROTFL: perProt ? 'Y' : 'N',
      COMPLFL: completed ? 'Y' : 'N',
    };
  });

/* ---------------- ADVS ---------------- */

const ADVS_COLS: Col[] = [
  { name: 'STUDYID', label: 'Study Identifier', type: 'char', role: 'Identifier', origin: 'Predecessor' },
  { name: 'USUBJID', label: 'Unique Subject Identifier', type: 'char', role: 'Identifier', origin: 'Predecessor' },
  { name: 'SITEID', label: 'Study Site Identifier', type: 'char', role: 'Identifier', origin: 'Predecessor', derivation: 'ADSL.SITEID.' },
  { name: 'TRTP', label: 'Planned Treatment', type: 'char', role: 'Treatment', origin: 'Derived', derivation: 'ADSL.TRT01P (single-period study).' },
  { name: 'TRTPN', label: 'Planned Treatment (N)', type: 'num', role: 'Treatment', origin: 'Derived', dec: 0, derivation: 'ADSL.TRT01PN: 0 = Placebo, 1 = VTX-221 10 mg, 2 = VTX-221 20 mg.' },
  { name: 'ITTFL', label: 'Intent-To-Treat Population Flag', type: 'char', role: 'Population flag', origin: 'Predecessor', derivation: 'ADSL.ITTFL.' },
  { name: 'PARAMCD', label: 'Parameter Code', type: 'char', role: 'Parameter', origin: 'Assigned', codelist: 'VSTESTCD (SYSBP, DIABP)' },
  { name: 'PARAM', label: 'Parameter', type: 'char', role: 'Parameter', origin: 'Assigned', derivation: '"Systolic Blood Pressure (mmHg)" or "Diastolic Blood Pressure (mmHg)".' },
  { name: 'PARAMN', label: 'Parameter (N)', type: 'num', role: 'Parameter', origin: 'Assigned', dec: 0, derivation: '1 = SYSBP, 2 = DIABP.' },
  { name: 'VISIT', label: 'Visit Name', type: 'char', role: 'Timing', origin: 'Predecessor', derivation: 'Collected visit: SCREENING, BASELINE, WEEK 2, WEEK 4, WEEK 8, WEEK 12, EARLY TERMINATION or UNSCHEDULED.' },
  { name: 'VISITNUM', label: 'Visit Number', type: 'num', role: 'Timing', origin: 'Predecessor', derivation: 'SCREENING 1, BASELINE 2, WEEK 2 3, WEEK 4 4, WEEK 8 5, WEEK 12 6, EARLY TERMINATION 99; UNSCHEDULED = preceding scheduled VISITNUM + 0.01 (a common convention, not a CDISC rule).' },
  { name: 'AVISIT', label: 'Analysis Visit', type: 'char', role: 'Timing', origin: 'Derived', derivation: 'SCREENING and BASELINE as collected. Post-baseline records are assigned by ADY to analysis windows: WEEK 2 = Days 2–21, WEEK 4 = Days 22–42, WEEK 8 = Days 43–70, WEEK 12 = Days 71–99 (so early-termination and unscheduled records get an analysis visit).' },
  { name: 'AVISITN', label: 'Analysis Visit (N)', type: 'num', role: 'Timing', origin: 'Derived', dec: 0, derivation: 'SCREENING -1, BASELINE 0, then the week number (2, 4, 8, 12).' },
  { name: 'ADT', label: 'Analysis Date', type: 'date', role: 'Timing', origin: 'Derived', derivation: 'Date of the blood-pressure assessment.' },
  { name: 'ADY', label: 'Analysis Relative Day', type: 'num', role: 'Timing', origin: 'Derived', dec: 0, derivation: 'ADT − TRTSDT + 1 if ADT >= TRTSDT, else ADT − TRTSDT (no Day 0). For the two never-dosed subjects RANDDT is the reference date.' },
  { name: 'AVAL', label: 'Analysis Value', type: 'num', role: 'Analysis value', origin: 'Derived', dec: 1, derivation: 'Mean of three seated readings taken at the visit, rounded to 0.1 mmHg (individual readings not included).' },
  { name: 'BASE', label: 'Baseline Value', type: 'num', role: 'Baseline', origin: 'Derived', dec: 1, derivation: 'AVAL of the record with ABLFL = "Y" for the same USUBJID and PARAMCD.' },
  { name: 'CHG', label: 'Change from Baseline', type: 'num', role: 'Analysis value', origin: 'Derived', dec: 1, derivation: 'AVAL − BASE for post-baseline records (AVISITN > 0); missing for screening and baseline records (sponsor convention).' },
  { name: 'PCHG', label: 'Percent Change from Baseline', type: 'num', role: 'Analysis value', origin: 'Derived', dec: 2, derivation: '100 × CHG / BASE, rounded to 2 decimals; post-baseline records only.' },
  { name: 'ABLFL', label: 'Baseline Record Flag', type: 'char', role: 'Flag', origin: 'Derived', derivation: '"Y" on the last non-missing value on or before first dose (Day 1 pre-dose); for never-dosed subjects, on or before RANDDT.' },
  { name: 'ANL01FL', label: 'Analysis Flag 01', type: 'char', role: 'Flag', origin: 'Derived', derivation: '"Y" on the baseline record and on one record per subject, parameter and post-baseline AVISIT: the record closest to the target day (15, 29, 57, 85); ties go to the later record. Blank for screening and for records not selected.' },
];

const advs: Row[] = [];
const sortedSubjects = subjects.slice().sort((a, b) => (a.usubjid < b.usubjid ? -1 : 1));
for (const s of sortedSubjects) {
  for (const [paramn, paramcd, param] of [
    [1, 'SYSBP', 'Systolic Blood Pressure (mmHg)'],
    [2, 'DIABP', 'Diastolic Blood Pressure (mmHg)'],
  ] as const) {
    const val = (m: Meas) => (paramcd === 'SYSBP' ? m.sbp : m.dbp);
    const base = val(s.meas[1]);
    const recs = s.meas
      .slice()
      .sort((a, b) => a.day - b.day || a.visitnum - b.visitnum)
      .map((m) => {
        let avisit = m.visit;
        let avisitn = m.visit === 'SCREENING' ? -1 : 0;
        let target: number | null = null;
        if (m.day > 1) {
          const w = WINDOWS.find((x) => m.day >= x.lo && m.day <= x.hi);
          if (!w) throw new Error(`no analysis window for day ${m.day}`);
          avisit = w.avisit;
          avisitn = w.avisitn;
          target = w.target;
        }
        const aval = val(m);
        const post = m.day > 1;
        const chg = post ? (Math.round(aval * 10) - Math.round(base * 10)) / 10 : null;
        return {
          m, avisit, avisitn, target,
          row: {
            STUDYID: STUDYID,
            USUBJID: s.usubjid,
            SITEID: s.site,
            TRTP: ARMS[s.arm],
            TRTPN: s.arm,
            ITTFL: 'Y',
            PARAMCD: paramcd,
            PARAM: param,
            PARAMN: paramn,
            VISIT: m.visit,
            VISITNUM: m.visitnum,
            AVISIT: avisit,
            AVISITN: avisitn,
            ADT: iso(s, m.day),
            ADY: m.day,
            AVAL: aval,
            BASE: base,
            CHG: chg,
            PCHG: chg === null ? null : round2((100 * chg) / base),
            ABLFL: m.visit === 'BASELINE' ? 'Y' : null,
            ANL01FL: m.visit === 'BASELINE' ? 'Y' : null,
          } as Row,
        };
      });
    // ANL01FL: one record per post-baseline analysis visit (closest to target; ties → later record)
    for (const w of WINDOWS) {
      const cands = recs.filter((r) => r.avisitn === w.avisitn);
      if (cands.length === 0) continue;
      cands.sort((a, b) => Math.abs(a.m.day - w.target) - Math.abs(b.m.day - w.target) || b.m.day - a.m.day);
      cands[0].row.ANL01FL = 'Y';
    }
    for (const r of recs) advs.push(r.row);
  }
}

/* ---------------- AE ---------------- */

const AE_COLS: Col[] = [
  { name: 'STUDYID', label: 'Study Identifier', type: 'char', role: 'Identifier', origin: 'Assigned' },
  { name: 'DOMAIN', label: 'Domain Abbreviation', type: 'char', role: 'Identifier', origin: 'Assigned' },
  { name: 'USUBJID', label: 'Unique Subject Identifier', type: 'char', role: 'Identifier', origin: 'Assigned' },
  { name: 'AESEQ', label: 'Sequence Number', type: 'num', role: 'Identifier', origin: 'Derived', dec: 0, derivation: 'Sequential within USUBJID after sorting by AESTDTC, AEDECOD.' },
  { name: 'AETERM', label: 'Reported Term for the Adverse Event', type: 'char', role: 'Topic', origin: 'Collected', notes: 'Verbatim text as entered at the site (varies in case and wording).' },
  { name: 'AEDECOD', label: 'Dictionary-Derived Term', type: 'char', role: 'Synonym Qualifier', origin: 'Assigned', notes: 'MedDRA-like preferred term, illustrative only (US spelling, no MedDRA codes).' },
  { name: 'AEBODSYS', label: 'Body System or Organ Class', type: 'char', role: 'Record Qualifier', origin: 'Assigned', notes: 'MedDRA-like system organ class, illustrative only.' },
  { name: 'AESEV', label: 'Severity/Intensity', type: 'char', role: 'Record Qualifier', origin: 'Collected', codelist: 'AESEV (MILD, MODERATE, SEVERE)' },
  { name: 'AESER', label: 'Serious Event', type: 'char', role: 'Record Qualifier', origin: 'Collected', codelist: 'NY' },
  { name: 'AEREL', label: 'Causality', type: 'char', role: 'Record Qualifier', origin: 'Collected', notes: 'Sponsor-defined two-level scale (RELATED / NOT RELATED); CDISC does not publish a single codelist for causality.' },
  { name: 'AEACN', label: 'Action Taken with Study Treatment', type: 'char', role: 'Record Qualifier', origin: 'Collected', codelist: 'ACN' },
  { name: 'AEOUT', label: 'Outcome of Adverse Event', type: 'char', role: 'Record Qualifier', origin: 'Collected', codelist: 'OUT' },
  { name: 'EPOCH', label: 'Epoch', type: 'char', role: 'Timing', origin: 'Derived', codelist: 'EPOCH', derivation: '"SCREENING" if AESTDTC is before the first dose, else "TREATMENT".' },
  { name: 'AESTDTC', label: 'Start Date/Time of Adverse Event', type: 'date', role: 'Timing', origin: 'Collected', notes: 'Complete ISO 8601 dates in this teaching dataset (no partial dates).' },
  { name: 'AEENDTC', label: 'End Date/Time of Adverse Event', type: 'date', role: 'Timing', origin: 'Collected', notes: 'Missing when the event was ongoing at the end of the subject\'s participation.' },
  { name: 'AESTDY', label: 'Study Day of Start of Adverse Event', type: 'num', role: 'Timing', origin: 'Derived', dec: 0, derivation: 'AESTDTC − RFSTDTC + 1 if on/after RFSTDTC (first dose), else AESTDTC − RFSTDTC (no Day 0).' },
  { name: 'AEENDY', label: 'Study Day of End of Adverse Event', type: 'num', role: 'Timing', origin: 'Derived', dec: 0, derivation: 'Same rule as AESTDY applied to AEENDTC.' },
];

const aeRows: Row[] = [];
const aeBySubj = new Map<string, AeRec[]>();
for (const a of aes) {
  const list = aeBySubj.get(a.s.usubjid) ?? [];
  list.push(a);
  aeBySubj.set(a.s.usubjid, list);
}
for (const s of sortedSubjects) {
  const list = (aeBySubj.get(s.usubjid) ?? []).sort((a, b) => a.start - b.start || (a.term.pt < b.term.pt ? -1 : a.term.pt > b.term.pt ? 1 : 0));
  list.forEach((a, i) => {
    aeRows.push({
      STUDYID: STUDYID,
      DOMAIN: 'AE',
      USUBJID: s.usubjid,
      AESEQ: i + 1,
      AETERM: a.verbatim,
      AEDECOD: a.term.pt,
      AEBODSYS: a.term.soc,
      AESEV: a.sev,
      AESER: a.ser,
      AEREL: a.rel,
      AEACN: a.acn,
      AEOUT: a.out,
      EPOCH: a.epoch,
      AESTDTC: iso(s, a.start),
      AEENDTC: iso(s, a.end),
      AESTDY: a.start,
      AEENDY: a.end,
    });
  });
}

/* ------------------------------------------------------------------ */
/* Writers                                                              */
/* ------------------------------------------------------------------ */

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
  const defs = cols.map((c) => `  ${c.name} ${c.type === 'num' ? (c.dec === 0 ? 'INTEGER' : 'REAL') : 'TEXT'}`).join(',\n');
  const out = [`CREATE TABLE ${table} (\n${defs}\n);`];
  for (const r of rows) out.push(`INSERT INTO ${table} VALUES (${cols.map((c) => sqlLiteral(r[c.name], c)).join(', ')});`);
  return out.join('\n') + '\n';
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'adsl.csv'), toCsv(ADSL_COLS, adsl));
writeFileSync(join(OUT, 'advs.csv'), toCsv(ADVS_COLS, advs));
writeFileSync(join(OUT, 'ae.csv'), toCsv(AE_COLS, aeRows));

/* ---------------- Manifest ---------------- */

const manifestCol = (c: Col) => {
  const o: Record<string, string> = { name: c.name, label: c.label, type: c.type };
  if (c.role) o.role = c.role;
  if (c.origin) o.origin = c.origin;
  if (c.codelist) o.codelist = c.codelist;
  if (c.derivation) o.derivation = c.derivation;
  if (c.notes) o.notes = c.notes;
  return o;
};

const manifest = {
  study: 'cardio',
  title: 'VTX221-201 — 12-week antihypertensive dose-ranging trial (synthetic)',
  description:
    'Fictional randomized, double-blind, placebo-controlled trial of VTX-221 10 mg and 20 mg once daily versus placebo in adults with essential hypertension (sponsor: Halden Therapeutics, fictional). Primary endpoint: change from baseline in seated systolic blood pressure at Week 12. Designed for teaching ANCOVA, repeated-measures (MMRM) analysis, missing data and safety summaries.',
  synthetic: true as const,
  generator: 'scripts/data/cardio/generate.ts',
  seed: SEED,
  datasets: [
    {
      id: 'cardio/adam/adsl',
      layer: 'adam',
      name: 'ADSL',
      label: 'Subject-Level Analysis Dataset',
      file: 'adsl.csv',
      rows: adsl.length,
      keys: ['USUBJID'],
      structure: 'One record per randomized subject',
      description: 'All randomized subjects (screen failures excluded): demographics, baseline characteristics, stratification, treatment, dates, disposition and population flags.',
      columns: ADSL_COLS.map(manifestCol),
    },
    {
      id: 'cardio/adam/advs',
      layer: 'adam',
      name: 'ADVS',
      label: 'Vital Signs Analysis Dataset',
      file: 'advs.csv',
      rows: advs.length,
      keys: ['USUBJID', 'PARAMCD', 'ADT', 'VISITNUM'],
      structure: 'BDS: one record per subject, parameter and assessment',
      description: 'Seated systolic (SYSBP) and diastolic (DIABP) blood pressure at screening, baseline (Day 1) and Weeks 2, 4, 8 and 12, plus early-termination and unscheduled assessments, with analysis windows (AVISIT), baseline, change from baseline and a one-record-per-visit analysis flag (ANL01FL).',
      columns: ADVS_COLS.map(manifestCol),
    },
    {
      id: 'cardio/sdtm/ae',
      layer: 'sdtm',
      name: 'AE',
      label: 'Adverse Events',
      file: 'ae.csv',
      rows: aeRows.length,
      keys: ['USUBJID', 'AESEQ'],
      structure: 'Events: one record per adverse event per subject',
      description: 'SDTM-like adverse events for treated subjects (plus a few events that started between screening and the first dose). Join to ADSL on USUBJID for treatment and population flags.',
      columns: AE_COLS.map(manifestCol),
    },
  ],
};
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

/* ---------------- README ---------------- */

const count = <T>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length;
const armRows = ARMS.map((name, a) => {
  const ss = subjects.filter((s) => s.arm === a);
  const disc = count(ss, (s) => s.discReason !== null);
  return `| ${name} | ${ss.length} | ${count(ss, (s) => !s.neverDosed)} | ${ss.length - disc} | ${disc} |`;
}).join('\n');
const reasonRows = [...REASONS]
  .map((r) => `| ${r} | ${ARMS.map((_, a) => count(subjects, (s) => s.arm === a && s.discReason === r)).join(' | ')} |`)
  .join('\n');

const readme = `# VTX221-201 — synthetic cardiovascular trial

> **Synthetic, fictional data for education.** No real patients, investigators, sites, sponsor or product.
> "Halden Therapeutics" and "VTX-221" are invented. Generated by \`scripts/data/cardio/generate.ts\`
> (seed ${SEED}); regenerate with \`npx tsx scripts/data/cardio/generate.ts\` (or \`npm run data -- cardio\`).
> Same seed → byte-identical CSV files.

## Design (protocol synopsis facts)

| Item | Value |
|---|---|
| STUDYID | \`${STUDYID}\` |
| Title | A Phase 2, Randomized, Double-Blind, Placebo-Controlled, Parallel-Group, Dose-Ranging Study of VTX-221 in Adults with Essential Hypertension |
| Sponsor | Halden Therapeutics (fictional) |
| Treatments | Placebo, VTX-221 10 mg, VTX-221 20 mg — one tablet once daily for 12 weeks |
| Randomization | 1:1:1, permuted blocks of 6, stratified by baseline seated SBP (<150 vs >=150 mmHg) via IxRS |
| Sites | 12 (101–109 USA, 110–112 Canada) |
| Key eligibility | Age 30–80; mean seated SBP 140–179 mmHg at screening and 130–179 mmHg at baseline; DBP < 110 mmHg |
| Visits | Screening (Day −14 to −7), Baseline (Day 1, randomization and first dose), Weeks 2, 4, 8 and 12 (trough visits) |
| Primary endpoint | Change from baseline in mean seated SBP at Week 12 |
| Primary analysis (SAP) | MMRM on all post-baseline visits (treatment, visit, treatment × visit, baseline SBP, baseline × visit; unstructured covariance); ANCOVA of Week 12 change on completers as a supportive analysis |
| Sample size (protocol) | 86 evaluable subjects per arm give 90% power to detect a 6 mmHg difference between VTX-221 20 mg and placebo in Week 12 SBP change (SD 12 mmHg, two-sided α = 0.05, two-sample t test); 90 per arm were planned to allow for about 5% of subjects without a Week 12 value |
| Screened / randomized | ${screened} screened, ${sfBp} failed blood-pressure criteria, ${sfOther} failed other criteria, ${N_RAND} randomized |

## Files

| File | Dataset id | Rows | Structure |
|---|---|---:|---|
| \`adsl.csv\` | \`cardio/adam/adsl\` | ${adsl.length} | One record per randomized subject |
| \`advs.csv\` | \`cardio/adam/advs\` | ${advs.length} | BDS, SYSBP and DIABP by assessment |
| \`ae.csv\` | \`cardio/sdtm/ae\` | ${aeRows.length} | SDTM-like AE, one record per event |
| \`cardio.sqlite\` | — | — | Same three tables (\`adsl\`, \`advs\`, \`ae\`) for the SQL lab |
| \`manifest.json\` | — | — | Column labels, types and derivations |
| \`FACTS.md\` | — | — | Key results computed in R from these files |

## Subject disposition

| Arm | Randomized | Treated | Completed Week 12 | Discontinued |
|---|---:|---:|---:|---:|
${armRows}

| Reason for discontinuation | Placebo | VTX-221 10 mg | VTX-221 20 mg |
|---|---:|---:|---:|
${reasonRows}

## Key derivation rules

- **Day 1** is the randomization day and the day of first dose; study days have no Day 0.
- **Baseline** (\`ABLFL = "Y"\`) is the Day 1 pre-dose value; \`BASE\` is carried to every record.
- **Analysis windows** (\`AVISIT\` by \`ADY\`): Week 2 = Days 2–21, Week 4 = 22–42, Week 8 = 43–70, Week 12 = 71–99.
  Early-termination and unscheduled records are windowed like any other record.
- **\`ANL01FL = "Y"\`** selects one record per subject, parameter and analysis visit (closest to the target day
  15/29/57/85; ties → later record). By-visit analyses should use \`ANL01FL = "Y"\`.
- **CHG** and **PCHG** are populated for post-baseline records only.
- **Populations**: ITT = all randomized (\`ITTFL\`); safety = took ≥1 dose (\`SAFFL\`); completers
  (\`COMPLFL\`); per-protocol = completers with 80–120% compliance (\`PPROTFL\`).
- **TEAE** (for analyses of \`ae.csv\`): \`AESTDY >= 1\`. Events with \`EPOCH = "SCREENING"\` started before the first dose.

## How the data were simulated (the "truth")

- Subject-level mean SBP depends on age, BMI and diabetes; visit values add an individual treatment
  response and a within-subject autoregressive fluctuation (correlation decays over weeks), then each
  visit value is the mean of three simulated seated readings.
- True mean SBP reductions at Week 12 (before regression-to-the-mean effects of screening selection):
  placebo −3.0, VTX-221 10 mg −8.5, VTX-221 20 mg −11.5 mmHg, attenuated by 2 mmHg in subjects with diabetes
  on active drug. Observed estimates differ from these values by sampling variability — use FACTS.md.
- **Dropout is missing at random (MAR):** the chance of stopping for lack of efficacy after Week 2 rises
  with the last *observed* SBP, so placebo subjects (higher SBP) drop out more often. Other reasons
  (withdrawal, loss to follow-up, adverse events, physician decision) occur at low constant rates, with more
  adverse-event discontinuations on 20 mg. A complete-case Week 12 analysis therefore differs from an MMRM
  that uses every observed visit.
- Two subjects were randomized but withdrew consent before the first dose (ITT, not safety).
- Three subjects were stratified in error at randomization (\`STRAT1R\` ≠ \`SBPGR1\`).

## Simplifications (educational)

- ADSL/ADVS follow ADaM naming conventions but are not a complete ADaMIG-conformant package (no ADAE,
  no define.xml, no SDTM DM/VS/EX; individual BP readings are not included).
- AE coding is MedDRA-like and illustrative (no MedDRA codes). Dates are complete (no partial dates).
- Dates are ISO 8601 text; in SAS, ADaM dates would be numeric with a \`DATE9.\` format.
- Race and ethnicity use the classic SDTM submission values; CDISC terminology in this area has been evolving.
`;
writeFileSync(join(OUT, 'README.md'), readme);

/* ---------------- SQLite ---------------- */

const sql = ['PRAGMA journal_mode = OFF;', 'BEGIN;', toSql('adsl', ADSL_COLS, adsl), toSql('advs', ADVS_COLS, advs), toSql('ae', AE_COLS, aeRows), 'COMMIT;'].join('\n');
const sqliteBin = existsSync('/usr/bin/sqlite3') ? '/usr/bin/sqlite3' : 'sqlite3';
const dbPath = join(OUT, 'cardio.sqlite');
if (existsSync(dbPath)) rmSync(dbPath);
const res = spawnSync(sqliteBin, [dbPath], { input: sql, encoding: 'utf8' });
if (res.status !== 0) console.warn(`sqlite3 not available or failed — cardio.sqlite not built. ${res.stderr ?? ''}`);

/* ---------------- FACTS.md (R) ---------------- */

const rCheck = spawnSync('Rscript', ['--version'], { encoding: 'utf8' });
if (rCheck.status === 0) {
  const r = spawnSync('Rscript', [join(here, 'facts.R')], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) console.warn('facts.R failed — FACTS.md not refreshed.');
} else {
  console.warn('Rscript not found — FACTS.md not refreshed (run scripts/data/cardio/facts.R in R).');
}

console.log(`cardio: ${adsl.length} subjects, ${advs.length} ADVS records, ${aeRows.length} AE records (screened ${screened}).`);
