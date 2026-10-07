/**
 * Truth model for CBX417-301: screened population, randomization, efficacy
 * (tumor scans, progression, death), follow-up and protocol deviations.
 * The treatment course and AEs live in course.ts, findings in findings.ts,
 * medications / history in conmed.ts.
 */
import {
  COUNTRIES, DCO, FIRST_RAND, LAST_RAND, N_RANDOMIZED, N_SCREENED, N_SCREEN_FAIL, REGION_SHARE, STUDYID,
  tumorWeeks, tumorVisit, type ArmCd, type Region, type Site,
} from './config.ts';
import { Rng, qnorm, stream } from './prng.ts';
import { partialOf, toWeekday, ymd } from './dates.ts';
import type { TAe, TContact, TScan, TSubject, Resp } from './types.ts';
import { planTreatment, simulateCourse, KitPool, makeAe } from './course.ts';
import { simulateFindings, simulateScreeningFindings } from './findings.ts';
import { simulateConmeds, subsequentTherapyName } from './conmed.ts';

export const PARAMS = {
  pfsScale: 218, // Weibull scale (days), control arm, ECOG 0, no brain metastases, frailty 0
  pfsShape: 1.05,
  hrPfs: 0.52, // conditional hazard ratio (marginal Cox HR ≈ 0.70 after frailty / durable-control mixture)
  hrEcog: 1.35,
  hrBrain: 1.3,
  bSquam: 0.05,
  frailSd: 0.3,
  d0Rate: 0.00023, // hazard/day of death before documented progression
  ppsMedian: 175, // days, post-progression survival (control, reference covariates)
  ppsShape: 1.05,
  hrPps: 1.28,
  frailPps: 0.15,
  muCbx: -0.265, // mean best % change in target-lesion sum (as a fraction), CBX-417 arm
  muPbo: -0.125,
  sdDepth: 0.22,
  rho: 0.65, // correlation between tumor shrinkage and time to progression (Gaussian copula)
  durCbx: 0.1, // fraction of subjects with durable disease control (much lower progression hazard)
  durPbo: 0.07,
  durHr: 0.12,
};
export type Params = typeof PARAMS;

export interface Truth {
  seed: number;
  sites: Site[];
  subjects: TSubject[];
  kits: { kit: string; content: 'CBX-417' | 'PLACEBO' }[];
  /** Subject indices chosen for special scenarios (used by raw issue injection and docs). */
  special: Record<string, string[]>;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/* ------------------------------------------------------------------ */
/* Sites and screened population                                       */
/* ------------------------------------------------------------------ */

function buildSites(seed: number): Site[] {
  const r = stream(seed, 'sites');
  const sites: Site[] = [];
  let id = 1001;
  for (const c of COUNTRIES)
    for (let i = 0; i < c.nSites; i++) sites.push({ siteId: String(id++), country: c, weight: 0.35 + 1.3 * r.next(), localLab: false, imperial: false });
  const usa = sites.filter((s) => s.country.code === 'USA');
  const jpn = sites.filter((s) => s.country.code === 'JPN');
  usa[0].localLab = true;
  usa[4].localLab = true;
  jpn[1].localLab = true;
  usa[1].imperial = true;
  usa[3].imperial = true;
  return sites;
}

function randomizationDates(seed: number): number[] {
  const r = stream(seed, 'rand-dates');
  const span = LAST_RAND - FIRST_RAND;
  // enrollment intensity ramps up over the first 200 days while sites activate, then plateaus
  const cum = (t: number) => (t <= 200 ? 0.25 * t + (0.75 * t * t) / 400 : 0.25 * 200 + (0.75 * 200) / 2 + (t - 200));
  const total = cum(span);
  const out = [FIRST_RAND, LAST_RAND];
  for (let i = 0; i < N_RANDOMIZED - 2; i++) {
    const u = r.next() * total;
    let lo = 0;
    let hi = span;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (cum(mid) < u) lo = mid;
      else hi = mid;
    }
    out.push(clamp(toWeekday(FIRST_RAND + Math.round(lo)), FIRST_RAND, LAST_RAND));
  }
  return out.sort((a, b) => a - b);
}

const HISTOLOGY = [
  { text: 'Adenocarcinoma', histol: 'NON-SQUAMOUS' as const, w: 0.64 },
  { text: 'Squamous cell carcinoma', histol: 'SQUAMOUS' as const, w: 0.28 },
  { text: 'Large cell carcinoma', histol: 'NON-SQUAMOUS' as const, w: 0.03 },
  { text: 'NSCLC not otherwise specified', histol: 'NON-SQUAMOUS' as const, w: 0.05 },
];

const SF_REASONS: [string, number][] = [
  ['Did not meet inclusion criterion 4: no measurable disease per RECIST 1.1', 11],
  ['Met exclusion criterion 3: actionable EGFR mutation or ALK rearrangement', 6],
  ['Did not meet inclusion criterion 6: inadequate organ function (laboratory values)', 9],
  ['Did not meet inclusion criterion 3: ECOG performance status 2', 6],
  ['Met exclusion criterion 7: symptomatic or untreated brain metastases', 5],
  ['Did not meet inclusion criterion 2: more than 2 prior lines of therapy', 4],
  ['Withdrew consent during screening', 5],
  ['Other: investigator decision (clinical deterioration during screening)', 2],
];

function newSubject(idx: number, site: Site, consent: number): TSubject {
  return {
    idx, site, subjid: '', usubjid: '', consent, screenDate: consent,
    age: 0, birthYear: 0, sex: 'M', races: [], raceOtherSp: null, ethnic: 'NOT HISPANIC OR LATINO', heightCm: 0, weightKg: 0,
    histology: '', histol: 'NON-SQUAMOUS', stage: '', diagDate: { y: 2020 }, diagDay: 0, pdl1: 0, priorLines: 1, priorIO: true,
    brainMets: false, smoking: 'FORMER', ecog: 0, baselineSld: 0,
    screenFail: false, sfReason: null, sfDate: null,
    randDate: null, randNo: null, arm: null, stratEcog: null, stratIO: null, misStrat: null,
    treated: false, neverTreatedReason: null, actualArm: null, unplanned: null, dispensingError: null,
    exCbx: [], exDoc: [], firstDose: null, firstDoseTime: null, lastDose: null, eotReason: null, eotReasonText: null, eotDate: null, cycleStarts: [],
    tProg: 0, pdDate: null, deathDate: null, deathCause: null, scans: [], missedPair: false, noBaselineScan: false, nactStart: null,
    withdrawalDate: null, ltfuDate: null, eosReason: null, eosDate: null, contacts: [],
    aes: [], labs: [], vitals: [], ecgs: [], cms: [], mhs: [], dvs: [], lastContact: consent, sfuDate: null, subTherapy: null,
    frailty: 0, depth: 0, pdType: 'target', tDeathNoPd: 0, pps: 0, zResp: 0, plan: null, flags: {},
  };
}

function genBaseline(s: TSubject, r: Rng) {
  const region = s.site.country.region;
  const apac = region === 'ASIA-PACIFIC';
  s.age = Math.floor(r.truncNorm(63.5, 9, 33, 85.99));
  s.sex = r.bool(0.61) ? 'M' : 'F';
  const { y } = ymd(s.consent);
  s.birthYear = y - s.age - (r.bool(0.5) ? 1 : 0);
  // race (checkbox style: MULTIPLE = two boxes ticked)
  const race = r.weighted(Object.keys(s.site.country.race), Object.values(s.site.country.race));
  if (race === 'MULTIPLE') s.races = r.bool(0.6) ? ['WHITE', 'BLACK OR AFRICAN AMERICAN'] : ['WHITE', 'ASIAN'];
  else if (race === 'OTHER') {
    s.races = ['OTHER'];
    s.raceOtherSp = r.pick(s.site.country.code === 'AUS' ? ['Aboriginal Australian', 'Maori'] : ['Arab', 'Middle Eastern', 'Mixed heritage']);
  } else s.races = [race];
  const hisp = s.site.country.hispanic;
  s.ethnic = r.bool(hisp) ? 'HISPANIC OR LATINO' : r.bool(s.site.country.code === 'FRA' ? 0.25 : 0.02) ? 'NOT REPORTED' : 'NOT HISPANIC OR LATINO';
  // anthropometrics (BSA constrained to 1.40–2.40 m2)
  const hMean = s.sex === 'M' ? (apac ? 169 : 176) : apac ? 157 : 163;
  const wMean = s.sex === 'M' ? (apac ? 65 : 80) : apac ? 54 : 66;
  for (let k = 0; k < 60; k++) {
    s.heightCm = Math.round(r.norm(hMean, s.sex === 'M' ? 6.5 : 6));
    s.weightKg = Math.round(r.norm(wMean, apac ? 9.5 : 13.5) * 10) / 10;
    const bsa = Math.sqrt((s.heightCm * s.weightKg) / 3600);
    if (bsa >= 1.4 && bsa <= 2.4 && s.weightKg >= 38) break;
  }
  // disease characteristics
  const h = r.weighted(HISTOLOGY, HISTOLOGY.map((x) => x.w));
  s.histology = h.text;
  s.histol = h.histol;
  s.stage = r.weighted(['IIIB', 'IIIC', 'IVA', 'IVB'], [0.06, 0.04, 0.45, 0.45]);
  s.priorLines = r.bool(0.65) ? 1 : 2;
  s.priorIO = r.bool(0.78);
  s.brainMets = r.bool(0.12);
  s.ecog = r.bool(0.38) ? 0 : 1;
  const asianF = s.races.includes('ASIAN') && s.sex === 'F';
  const pNever = clamp(0.13 + (asianF ? 0.4 : 0) - (s.histol === 'SQUAMOUS' ? 0.09 : 0), 0.02, 0.8);
  const u = r.next();
  s.smoking = u < pNever ? 'NEVER' : u < pNever + 0.14 ? 'CURRENT' : 'FORMER';
  const cat = r.weighted([0, 1, 2], [0.35, 0.4, 0.25]);
  s.pdl1 = cat === 0 ? 0 : cat === 1 ? r.pick([1, 2, 5, 5, 10, 10, 15, 20, 25, 30, 40, 45]) : r.pick([50, 55, 60, 70, 75, 80, 90, 95, 100]);
  const months = s.priorLines * r.unif(6, 14) + r.unif(1, 5);
  s.diagDay = s.consent - Math.round(months * 30.4);
  const pk = r.next();
  s.diagDate = partialOf(s.diagDay, pk < 0.2 ? 'month' : pk < 0.26 ? 'year' : 'full');
  s.baselineSld = Math.round(clamp(r.lognormal(68, 0.5), 12, 230));
}

function buildScreened(seed: number, sites: Site[], special: Record<string, string[]>): TSubject[] {
  const r = stream(seed, 'screened');
  const rand = randomizationDates(seed);
  const regions = Object.keys(REGION_SHARE) as Region[];
  const pickSite = () => {
    const reg = r.weighted(regions, regions.map((g) => REGION_SHARE[g]));
    const cand = sites.filter((s) => s.country.region === reg);
    return r.weighted(cand, cand.map((s) => s.weight));
  };
  const subjects: TSubject[] = [];
  for (let i = 0; i < N_RANDOMIZED; i++) {
    const rd = rand[i];
    const consent = toWeekday(rd - r.int(6, 27));
    const s = newSubject(i, pickSite(), Math.min(consent, rd - 3));
    s.randDate = rd;
    subjects.push(s);
  }
  const sfReasons: string[] = [];
  for (const [txt, n] of SF_REASONS) for (let k = 0; k < n; k++) sfReasons.push(txt);
  r.shuffle(sfReasons);
  for (let i = 0; i < N_SCREEN_FAIL; i++) {
    const consent = toWeekday(r.int(FIRST_RAND - 20, LAST_RAND - 8));
    const s = newSubject(N_RANDOMIZED + i, pickSite(), consent);
    s.screenFail = true;
    s.sfReason = sfReasons[i];
    s.sfDate = toWeekday(consent + r.int(6, 27));
    subjects.push(s);
  }
  // screening order → subject numbers within site
  const key = new Map(subjects.map((s) => [s, r.next()]));
  const ordered = [...subjects].sort((a, b) => a.consent - b.consent || key.get(a)! - key.get(b)!);
  const counter = new Map<string, number>();
  ordered.forEach((s, k) => {
    s.idx = k;
    const n = (counter.get(s.site.siteId) ?? 0) + 1;
    counter.set(s.site.siteId, n);
    s.subjid = `${s.site.siteId}-${String(n).padStart(4, '0')}`;
    s.usubjid = `${STUDYID}-${s.subjid}`;
  });
  for (const s of ordered) {
    const rb = stream(seed, `baseline/${s.subjid}`);
    genBaseline(s, rb);
    s.screenDate = s.randDate !== null ? Math.min(toWeekday(s.consent + rb.int(0, 5)), s.randDate - 1) : toWeekday(s.consent + rb.int(0, 4));
    if (s.screenDate < s.consent) s.screenDate = s.consent;
    if (s.screenFail) {
      if (s.sfReason!.includes('ECOG performance status 2')) s.ecog = 2;
      if (s.sfReason!.includes('more than 2 prior lines')) s.priorLines = 3;
      if (s.sfReason!.includes('brain metastases')) s.brainMets = true;
    }
  }
  // one genuine extreme body weight (verified at source; must not be "cleaned")
  const heavy = ordered.find((s) => !s.screenFail && s.sex === 'F' && s.site.country.region !== 'ASIA-PACIFIC' && s.idx > 100)!;
  heavy.heightCm = 156;
  heavy.weightKg = 131.2;
  special.genuineWeight = [heavy.subjid];
  // eligibility violation visible in the data: 3 prior lines in a randomized subject
  const lines3 = ordered.find((s) => !s.screenFail && s.idx > 150 && s.priorLines === 2)!;
  lines3.priorLines = 3;
  special.threeLines = [lines3.subjid];
  return ordered;
}

/* ------------------------------------------------------------------ */
/* Randomization (IxRS, stratified permuted blocks of 4)                */
/* ------------------------------------------------------------------ */

function randomize(seed: number, subjects: TSubject[], special: Record<string, string[]>) {
  const r = stream(seed, 'ixrs');
  const rand = subjects.filter((s) => !s.screenFail).sort((a, b) => a.randDate! - b.randDate! || a.idx - b.idx);
  for (const s of rand) {
    s.stratEcog = s.ecog;
    s.stratIO = s.priorIO;
  }
  const mis = r.sample(rand.filter((s) => s.idx > 20), 8);
  mis.slice(0, 5).forEach((s) => {
    s.stratEcog = 1 - s.ecog;
    s.misStrat = `ECOG PS entered in IxRS as ${s.stratEcog} (CRF: ${s.ecog})`;
  });
  mis.slice(5).forEach((s) => {
    s.stratIO = !s.priorIO;
    s.misStrat = `Prior anti-PD-(L)1 entered in IxRS as ${s.stratIO ? 'Yes' : 'No'} (CRF: ${s.priorIO ? 'Yes' : 'No'})`;
  });
  special.misStrat = mis.map((s) => s.subjid);
  for (let attempt = 0; attempt < 500; attempt++) {
    const rb = stream(seed, `blocks/${attempt}`);
    const queues = new Map<string, ArmCd[]>();
    const seq = new Map<string, number>();
    let nCbx = 0;
    for (const s of rand) {
      const k = `${s.stratEcog}/${s.stratIO ? 'Y' : 'N'}`;
      let q = queues.get(k);
      if (!q || q.length === 0) {
        q = rb.shuffle<ArmCd>(['CBX+DOC', 'CBX+DOC', 'PBO+DOC', 'PBO+DOC']);
        queues.set(k, q);
      }
      s.arm = q.shift()!;
      if (s.arm === 'CBX+DOC') nCbx++;
      const stratumNo = (s.stratEcog === 0 ? 1 : 3) + (s.stratIO ? 0 : 1);
      const n = (seq.get(k) ?? 0) + 1;
      seq.set(k, n);
      s.randNo = `${stratumNo}${String(n).padStart(3, '0')}`;
    }
    if (nCbx === N_RANDOMIZED / 2) return;
  }
  throw new Error('could not reach a 210/210 allocation');
}

/* ------------------------------------------------------------------ */
/* Efficacy truth: progression, death, tumor assessments               */
/* ------------------------------------------------------------------ */

function latentEfficacy(s: TSubject, r: Rng, P: Params) {
  const trt = s.arm === 'CBX+DOC' ? 1 : 0;
  s.frailty = P.frailSd * r.normal();
  const durable = r.bool(trt ? P.durCbx : P.durPbo);
  s.flags.durable = durable;
  const lp =
    Math.log(P.hrEcog) * (s.ecog >= 1 ? 1 : 0) + Math.log(P.hrBrain) * (s.brainMets ? 1 : 0) + P.bSquam * (s.histol === 'SQUAMOUS' ? 1 : 0) + s.frailty + Math.log(P.hrPfs) * trt + (durable ? Math.log(P.durHr) : 0);
  let u = r.next();
  while (u < 1e-9) u = r.next();
  s.tProg = P.pfsScale * Math.pow(-Math.log(u) / Math.exp(lp), 1 / P.pfsShape);
  const zTP = qnorm(1 - u);
  s.zResp = P.rho * zTP + Math.sqrt(1 - P.rho * P.rho) * r.normal();
  let d = (trt ? P.muCbx : P.muPbo) - P.sdDepth * s.zResp;
  d = clamp(d, -1, 0.3);
  if (s.tProg < 60) d = Math.max(d, -0.22);
  if (d <= -0.93) d = -1;
  s.depth = d;
  s.pdType = d === -1 ? 'new' : r.weighted(['target', 'new', 'nontarget'] as const, [0.6, 0.3, 0.1]);
  const ld = Math.log(1.6) * (s.ecog >= 1 ? 1 : 0) + Math.log(1.3) * (s.brainMets ? 1 : 0) + 0.5 * s.frailty;
  s.tDeathNoPd = r.exp(P.d0Rate * Math.exp(ld));
  const lpp = Math.log(1.3) * (s.ecog >= 1 ? 1 : 0) + Math.log(1.25) * (s.brainMets ? 1 : 0) + P.frailPps * s.frailty + Math.log(P.hrPps) * trt;
  const scale = P.ppsMedian / Math.pow(Math.LN2, 1 / P.ppsShape);
  let u2 = r.next();
  while (u2 < 1e-9) u2 = r.next();
  s.pps = Math.max(3, scale * Math.pow(-Math.log(u2) / Math.exp(lpp), 1 / P.ppsShape));
}

interface Slot {
  week: number | null;
  date: number;
  missed: boolean;
  oow: boolean;
  unscheduled: boolean;
}

/** Build scan dates, find documented PD / death, and evaluate RECIST responses. */
function simulateEfficacy(s: TSubject, r: Rng) {
  const R = s.randDate!;
  const method: 'CT SCAN' | 'MRI' = r.bool(s.brainMets ? 0.25 : 0.05) ? 'MRI' : 'CT SCAN';
  const stop = Math.min(DCO, s.withdrawalDate ?? Infinity);
  const slots: Slot[] = [];
  for (const w of tumorWeeks(DCO - R)) {
    let j = clamp(Math.round(r.norm(0, 2.2)), -6, 6);
    let oow = false;
    if (r.bool(0.025)) {
      j = (r.bool(0.5) ? 1 : -1) * r.int(9, 13);
      oow = true;
    }
    slots.push({ week: w, date: toWeekday(R + 7 * w + j), missed: false, oow, unscheduled: false });
  }
  const tP = R + Math.ceil(s.tProg);
  let pdIdx = slots.findIndex((x) => x.date >= tP);
  // missed assessments
  if (s.flags.missPair) {
    if (pdIdx >= 3) {
      if (r.bool(0.7)) {
        slots[pdIdx - 1].missed = true;
        slots[pdIdx - 2].missed = true;
      } else {
        const k = r.int(0, pdIdx - 3);
        slots[k].missed = true;
        slots[k + 1].missed = true;
      }
      s.missedPair = true;
    } else if (pdIdx === -1 || pdIdx > 5) {
      const lim = pdIdx === -1 ? Math.min(slots.length - 2, 8) : pdIdx - 2;
      if (lim >= 1) {
        const k = r.int(1, lim);
        slots[k].missed = true;
        slots[k + 1].missed = true;
        s.missedPair = true;
      }
    }
  }
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].missed || (i > 0 && slots[i - 1].missed) || (i + 1 < slots.length && slots[i + 1].missed)) continue;
    if (i !== pdIdx && r.bool(0.018)) slots[i].missed = true;
  }
  // PD found at an unscheduled scan (clinical suspicion) for some subjects
  if (pdIdx >= 0 && r.bool(0.1)) {
    const d = toWeekday(tP + r.int(3, 10));
    const prev = pdIdx > 0 ? slots[pdIdx - 1].date : R;
    if (d < slots[pdIdx].date - 7 && d > prev + 10) {
      slots.splice(pdIdx, 0, { week: null, date: d, missed: false, oow: false, unscheduled: true });
    }
  }
  pdIdx = slots.findIndex((x) => !x.missed && x.date >= tP);
  const pdScanDate = pdIdx >= 0 ? slots[pdIdx].date : Infinity;
  const deathNoPd = R + Math.max(1, Math.round(s.tDeathNoPd));
  let death: number | null = null;
  let pd: number | null = null;
  if (deathNoPd < pdScanDate) {
    if (deathNoPd <= stop) death = deathNoPd;
  } else if (pdScanDate <= stop) {
    pd = pdScanDate;
    const d = pd + Math.round(s.pps);
    if (d <= stop) death = d;
  }
  s.pdDate = pd;
  s.deathDate = death;
  if (death !== null && pd === null) s.deathCause = r.bool(0.5) ? 'Other' : 'Unknown';
  if (death !== null && pd !== null) s.deathCause = r.weighted(['Progressive disease', 'Other', 'Unknown'] as const, [0.9, 0.05, 0.05]);
  // performed scans
  const lastDay = Math.min(stop, death !== null ? death - 1 : Infinity, pd ?? Infinity);
  const performed = slots.filter((x) => !x.missed && x.date <= lastDay && x.date > R);
  const scans: TScan[] = [];
  if (!s.noBaselineScan) {
    let d = toWeekday(r.int(Math.max(s.consent, R - 27), R - 1));
    if (d >= R) d = R - 1;
    if (d < s.consent) d = s.consent;
    scans.push({ visitName: 'SCREENING', visitNum: 1, week: null, date: d, method, sld: s.baselineSld, nt: null, newLesion: null, resp: null, baseline: true, outOfWindow: false });
  }
  const pdIndexInPerformed = pd !== null ? performed.findIndex((x) => x.date === pd) : -1;
  evaluateRecist(s, performed, pdIndexInPerformed, method, scans, r);
  s.scans = scans;
}

function evaluateRecist(s: TSubject, performed: Slot[], pdI: number, method: 'CT SCAN' | 'MRI', out: TScan[], r: Rng) {
  const R = s.randDate!;
  const B = s.baselineSld;
  const d = s.depth;
  const cr = d === -1;
  const tP = s.tProg;
  let tn = 0;
  if (d < 0) tn = Math.max(21, tP > 100 ? Math.min(tP - 35, r.unif(56, 190)) : tP * 0.55);
  const nadirTrue = d < 0 ? B * (1 + d) : B;
  const thrTarget = Math.max(1.2 * nadirTrue, nadirTrue + 5);
  const thrPath = s.pdType === 'target' ? thrTarget : nadirTrue + (thrTarget - nadirTrue) * r.unif(0.2, 0.85);
  const S = (t: number) => {
    if (d < 0 && t <= tn) {
      const x = t / tn;
      return B * (1 + d * (1 - (1 - x) * (1 - x)));
    }
    if (cr) return 0;
    const t0 = d < 0 ? tn : 0;
    const frac = Math.max(0, (t - t0) / Math.max(1, tP - t0));
    return nadirTrue + (thrPath - nadirTrue) * Math.pow(frac, 1.3);
  };
  let nadirM = B;
  for (let i = 0; i < performed.length; i++) {
    const sl = performed[i];
    const isPD = i === pdI;
    const vis = sl.unscheduled ? { name: 'UNSCHEDULED', num: 0 } : tumorVisit(sl.week!);
    const base = { visitName: vis.name, visitNum: vis.num, week: sl.week, date: sl.date, method, baseline: false, outOfWindow: sl.oow };
    if (!isPD && r.bool(0.015)) {
      out.push({ ...base, sld: null, nt: 'NE', newLesion: 'N', resp: 'NE' });
      continue;
    }
    const t = sl.date - R;
    let m = Math.max(0, Math.round(S(t) * (1 + 0.025 * r.normal())));
    if (cr && t > tn) m = 0;
    const pdCap = Math.max(Math.ceil(1.2 * nadirM) - 1, nadirM + 4);
    const pdMin = Math.max(Math.ceil(1.2 * nadirM - 1e-9), nadirM + 5);
    if (isPD && s.pdType === 'target' && !cr) m = Math.max(m, pdMin + r.int(0, 3));
    else m = Math.min(m, pdCap);
    if (s.noBaselineScan) {
      out.push({ ...base, sld: m, nt: isPD ? 'NON-CR/NON-PD' : 'NON-CR/NON-PD', newLesion: isPD ? 'Y' : 'N', resp: isPD ? 'PD' : 'NE' });
      continue;
    }
    let tr: Resp;
    if (isPD && s.pdType === 'target' && !cr) tr = 'PD';
    else if (m === 0) tr = 'CR';
    else if (m <= 0.7 * B) tr = 'PR';
    else tr = 'SD';
    let nt: TScan['nt'] = cr && m === 0 ? 'CR' : 'NON-CR/NON-PD';
    if (isPD && s.pdType === 'nontarget' && !cr) nt = 'PD';
    const newLesion = isPD && (s.pdType === 'new' || cr) ? 'Y' : 'N';
    let resp: Resp;
    if (tr === 'PD' || nt === 'PD' || newLesion === 'Y') resp = 'PD';
    else if (tr === 'CR' && nt === 'CR') resp = 'CR';
    else if (tr === 'CR' || tr === 'PR') resp = 'PR';
    else resp = 'SD';
    nadirM = Math.min(nadirM, m);
    out.push({ ...base, sld: m, nt, newLesion, resp });
  }
}

/* ------------------------------------------------------------------ */
/* Post-treatment: new anticancer therapy, follow-up, disposition      */
/* ------------------------------------------------------------------ */

function applyNact(s: TSubject, r: Rng) {
  if (!s.treated || s.lastDose === null) return;
  const early = s.eotReason === 'ADVERSE EVENT' || s.eotReason === 'PHYSICIAN DECISION' || s.eotReason === 'WITHDRAWAL BY SUBJECT';
  if (!early || s.withdrawalDate !== null) return;
  const p = s.eotReason === 'PHYSICIAN DECISION' ? 0.85 : 0.6;
  if (!r.bool(p)) {
    // some sites stop tumor assessments after treatment ends (protocol deviation)
    if (r.bool(0.25)) {
      const cut = s.lastDose + r.int(20, 45);
      s.scans = s.scans.filter((x) => x.baseline || x.date <= cut);
      if (s.pdDate !== null && s.pdDate > cut) s.pdDate = null;
      s.flags.scansStopped = true;
    }
    return;
  }
  const start = toWeekday(s.lastDose + r.int(14, 75));
  if (start > DCO || (s.deathDate !== null && start >= s.deathDate) || (s.pdDate !== null && start >= s.pdDate)) return;
  s.nactStart = start;
  s.flags.nactBeforePd = true;
  if (r.bool(0.5)) {
    // site stops tumor assessments once new therapy starts
    s.scans = s.scans.filter((x) => x.baseline || x.date <= start);
    if (s.pdDate !== null && s.pdDate > start) s.pdDate = null;
  }
}

function simulateFollowUp(s: TSubject, r: Rng) {
  const R = s.randDate!;
  const alive = (d: number) => s.deathDate === null || d < s.deathDate;
  const wd = s.withdrawalDate ?? Infinity;
  if (s.treated && s.eotReason !== null && s.lastDose !== null) {
    const d = toWeekday(s.lastDose + 30 + r.int(-7, 7));
    if (d <= DCO && alive(d) && d < wd) s.sfuDate = d;
  }
  // subsequent anticancer therapy after documented progression
  let subTherapy: { name: string; start: number } | null = null;
  if (s.pdDate !== null && (s.deathDate === null || s.deathDate - s.pdDate > 25) && s.withdrawalDate === null && r.bool(0.55)) {
    const st = toWeekday(s.pdDate + r.int(14, 56));
    if (st <= DCO && alive(st)) subTherapy = { name: subsequentTherapyName(s, r), start: st };
  }
  if (s.nactStart !== null) subTherapy = { name: subsequentTherapyName(s, r), start: s.nactStart };
  s.subTherapy = subTherapy;
  // survival follow-up (phone contact every 12 weeks) after treatment ends
  let t0: number | null = null;
  if (s.treated) {
    if (s.eotReason !== null) t0 = s.sfuDate ?? s.eotDate ?? s.lastDose;
  } else if (s.neverTreatedReason !== null && s.withdrawalDate === null) t0 = R;
  const contacts: TContact[] = [];
  if (t0 !== null && t0 < wd) {
    const ltfu = r.bool(0.017);
    let lostAfter = ltfu ? r.int(1, 4) : Infinity;
    let reported = false;
    for (let n = 1; n < 60; n++) {
      const d = toWeekday(t0 + 84 * n + r.int(-7, 7));
      if (d > DCO || d >= wd) break;
      if (s.deathDate !== null && d >= s.deathDate) {
        const dd = toWeekday(Math.max(s.deathDate + 1, Math.min(d, s.deathDate + r.int(2, 30))));
        if (dd <= DCO) contacts.push({ n, date: dd, status: 'Dead', newTherapy: 'N', therapyName: null, therapyStart: null });
        break;
      }
      if (n > lostAfter) {
        const decl = toWeekday(d + r.int(20, 60));
        if (decl <= DCO && alive(decl)) {
          contacts.push({ n, date: decl, status: 'Lost to follow-up', newTherapy: 'N', therapyName: null, therapyStart: null });
          s.ltfuDate = decl;
        }
        break;
      }
      const c: TContact = { n, date: d, status: 'Alive', newTherapy: 'N', therapyName: null, therapyStart: null };
      if (subTherapy && !reported && subTherapy.start <= d) {
        c.newTherapy = 'Y';
        c.therapyName = subTherapy.name;
        c.therapyStart = subTherapy.start;
        reported = true;
      }
      contacts.push(c);
    }
    if (s.ltfuDate === null) {
      const last = contacts.length ? contacts[contacts.length - 1] : null;
      const inFu = !last || last.status === 'Alive';
      if (inFu && (s.deathDate === null) && wd === Infinity && (!last || last.date < DCO - 20)) {
        const d = toWeekday(DCO - r.int(2, 13));
        if (d > (last?.date ?? t0) + 14) {
          const c: TContact = { n: (last?.n ?? 0) + 1, date: d, status: 'Alive', newTherapy: 'N', therapyName: null, therapyStart: null };
          if (subTherapy && !reported && subTherapy.start <= d) {
            c.newTherapy = 'Y';
            c.therapyName = subTherapy.name;
            c.therapyStart = subTherapy.start;
          }
          contacts.push(c);
        }
      }
    }
    lostAfter = 0;
  }
  s.contacts = contacts;
  // end of study
  if (s.deathDate !== null) {
    s.eosReason = 'DEATH';
    s.eosDate = s.deathDate;
  } else if (s.withdrawalDate !== null) {
    s.eosReason = 'WITHDRAWAL BY SUBJECT';
    s.eosDate = s.withdrawalDate;
  } else if (s.ltfuDate !== null) {
    s.eosReason = 'LOST TO FOLLOW-UP';
    s.eosDate = s.ltfuDate;
  }
}

/* ------------------------------------------------------------------ */
/* Protocol deviations (CTMS)                                           */
/* ------------------------------------------------------------------ */

function deviations(s: TSubject, r: Rng) {
  const R = s.randDate!;
  const add = (category: string, description: string, date: number, severity: 'Major' | 'Minor') => {
    if (date <= DCO) s.dvs.push({ category, description, date, severity });
  };
  if (s.dispensingError) add('INVESTIGATIONAL PRODUCT', s.dispensingError, s.exCbx.find((e) => (s.arm === 'PBO+DOC' ? e.content === 'CBX-417' : true))?.start ?? R, 'Major');
  if (s.misStrat) add('RANDOMIZATION/STRATIFICATION', `Stratification error at randomization: ${s.misStrat}`, R, 'Minor');
  if (s.noBaselineScan) add('EFFICACY ASSESSMENT', 'Baseline tumor assessment not performed within 28 days before randomization', R, 'Major');
  if (s.missedPair) {
    const d = s.scans.filter((x) => !x.baseline).map((x) => x.date);
    add('EFFICACY ASSESSMENT', 'Two consecutive scheduled tumor assessments not performed', d.length ? d[Math.floor(d.length / 2)] : R + 90, 'Major');
  }
  for (const sc of s.scans) if (sc.outOfWindow) add('VISIT WINDOW', `Tumor assessment (${sc.visitName}) performed outside the +/-7 day window`, sc.date, 'Minor');
  if (s.flags.threeLines) add('ELIGIBILITY CRITERIA', 'Subject randomized with 3 prior lines of systemic therapy (inclusion criterion 2)', R, 'Major');
  if (s.flags.altIneligible) add('ELIGIBILITY CRITERIA', 'Screening ALT >2.5 x ULN (inclusion criterion 6) - subject randomized', R, 'Major');
  if (s.flags.randomizedInError) add('ELIGIBILITY CRITERIA', 'EGFR exon 19 deletion reported after randomization (exclusion criterion 3)', R + 3, 'Major');
  if (s.flags.brainMetsDv) add('ELIGIBILITY CRITERIA', 'Brain metastases not treated/stable for >=4 weeks before randomization (exclusion criterion 7)', R, 'Major');
  if (s.flags.radiotherapy) add('PROHIBITED THERAPY', 'Palliative radiotherapy to a target lesion while on study treatment', (s.cycleStarts[2] ?? R + 60) + 5, 'Major');
  if (s.flags.icfLate) add('INFORMED CONSENT', 'Re-consent to protocol amendment 2 obtained after the next study visit', (s.cycleStarts[3] ?? R + 60) + 1, 'Minor');
  if (s.flags.icfAfterProc) add('INFORMED CONSENT', 'Screening laboratory sample collected before informed consent was signed', s.consent, 'Major');
  if (s.flags.compliance) add('INVESTIGATIONAL PRODUCT', `Study drug compliance <80% in Cycle ${Math.min(3, s.cycleStarts.length)}`, s.cycleStarts[Math.min(2, s.cycleStarts.length - 1)] ?? R, 'Minor');
  if (s.flags.saeLate) {
    const sae = s.aes.find((a) => a.serious);
    if (sae) add('SAFETY REPORTING', 'Serious adverse event reported to sponsor more than 24 hours after site awareness', sae.start + r.int(2, 6), 'Minor');
  }
  if (s.flags.labMissed && s.cycleStarts.length > 3) add('STUDY PROCEDURES', 'Cycle 3 Day 1 laboratory assessments not performed per protocol', s.cycleStarts[2], 'Minor');
  if (s.flags.ecgMissed && s.cycleStarts.length > 1) add('STUDY PROCEDURES', 'Cycle 2 Day 1 ECG not performed', s.cycleStarts[1], 'Minor');
  if (s.flags.visitOow && s.cycleStarts.length > 4) add('VISIT WINDOW', 'Cycle 4 Day 1 visit performed outside the +/-3 day window', s.cycleStarts[3], 'Minor');
  s.dvs.sort((a, b) => a.date - b.date);
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                        */
/* ------------------------------------------------------------------ */

export function buildTruth(seed: number, P: Params = PARAMS): Truth {
  const special: Record<string, string[]> = {};
  const sites = buildSites(seed);
  const subjects = buildScreened(seed, sites, special);
  randomize(seed, subjects, special);
  const rnd = subjects.filter((s) => !s.screenFail);
  const pick = stream(seed, 'special-subjects');
  const bySub = (ids: string[]) => ids.map((id) => subjects.find((s) => s.subjid === id)!);
  bySub(special.threeLines).forEach((s) => (s.flags.threeLines = true));

  // never treated: 2 per arm
  const cbx = rnd.filter((s) => s.arm === 'CBX+DOC' && s.idx > 30);
  const pbo = rnd.filter((s) => s.arm === 'PBO+DOC' && s.idx > 30);
  const nt = [...pick.sample(cbx, 2), ...pick.sample(pbo, 2)];
  const ntReasons = ['WITHDRAWAL BY SUBJECT', 'PHYSICIAN DECISION', 'RANDOMIZED BY MISTAKE WITHOUT STUDY TREATMENT', 'WITHDRAWAL BY SUBJECT'];
  nt.forEach((s, i) => (s.neverTreatedReason = ntReasons[i]));
  special.neverTreated = nt.map((s) => s.subjid);
  for (const s of rnd) s.treated = s.neverTreatedReason === null;

  // subjects without a baseline scan, with >=2 consecutive missed scans
  const treated = rnd.filter((s) => s.treated);
  const nb = pick.sample(treated, 2);
  nb.forEach((s) => (s.noBaselineScan = true));
  special.noBaselineScan = nb.map((s) => s.subjid);
  const mp = pick.sample(treated.filter((s) => !s.noBaselineScan), 24);
  mp.forEach((s) => (s.flags.missPair = true));

  // withdrawal of consent (study) and efficacy truth
  for (const s of rnd) {
    const r = stream(seed, `efficacy/${s.subjid}`);
    latentEfficacy(s, r, P);
    if (r.bool(0.04)) s.withdrawalDate = toWeekday(s.randDate! + r.int(20, 700));
    if (s.withdrawalDate !== null && s.withdrawalDate > DCO) s.withdrawalDate = null;
    const i = nt.indexOf(s);
    if (i === 0) s.withdrawalDate = toWeekday(s.randDate! + 2);
    if (i === 3) s.withdrawalDate = toWeekday(s.randDate! + 1);
    if (i === 1) {
      s.tDeathNoPd = r.int(25, 60);
      s.tProg = Math.max(s.tProg, 200);
    }
    if (i === 2) s.flags.randomizedInError = true;
    if (i === 0 || i === 3 || i === 2) s.flags.noScans = true;
    simulateEfficacy(s, r);
    if (s.flags.noScans) s.scans = s.scans.filter((x) => x.baseline);
    if (s.flags.noScans) s.pdDate = null;
    if (i === 1) s.deathCause = 'Other';
    if (i === 2) {
      // randomized in error: followed for survival on an EGFR inhibitor, no tumor assessments
      s.pdDate = null;
      s.flags.egfr = true;
    }
  }

  // treatment plans, dispensing errors
  for (const s of rnd) if (s.treated) planTreatment(s, stream(seed, `plan/${s.subjid}`));
  const meanN: Record<string, number> = {};
  for (const arm of ['CBX+DOC', 'PBO+DOC']) {
    const xs = rnd.filter((s) => s.treated && s.arm === arm).map((s) => s.plan!.n0);
    meanN[arm] = xs.reduce((a, b) => a + b, 0) / xs.length;
  }
  const pboLong = pick.sample(rnd.filter((s) => s.treated && s.arm === 'PBO+DOC' && s.plan!.n0 >= 6 && !s.noBaselineScan), 2);
  const cbxShort = pick.sample(rnd.filter((s) => s.treated && s.arm === 'CBX+DOC' && s.plan!.n0 >= 2 && s.plan!.n0 <= 3), 1);
  pboLong[0].flags.errCycles2 = true;
  pboLong[1].flags.errCycles34 = true;
  cbxShort[0].flags.errAllPlacebo = true;
  special.dispensingError = [...pboLong, ...cbxShort].map((s) => s.subjid);

  const kits = new KitPool(seed);
  for (const s of rnd) {
    if (s.treated) simulateCourse(s, seed, meanN, kits);
    else {
      s.actualArm = null;
      if (s.deathDate !== null && s.deathCause === null) s.deathCause = 'Other';
    }
  }
  // other study-conduct flags (deviations)
  const dvPick = (n: number, flag: string, pool = rnd.filter((s) => s.treated)) => pick.sample(pool.filter((s) => !s.flags[flag]), n).forEach((s) => (s.flags[flag] = true));
  dvPick(1, 'brainMetsDv', rnd.filter((s) => s.treated && s.brainMets));
  dvPick(2, 'radiotherapy', rnd.filter((s) => s.treated && s.cycleStarts.length >= 4));
  dvPick(6, 'icfLate', rnd.filter((s) => s.treated && s.cycleStarts.length >= 5));
  dvPick(2, 'icfAfterProc');
  dvPick(12, 'compliance');
  dvPick(7, 'saeLate', rnd.filter((s) => s.aes.some((a) => a.serious)));
  dvPick(10, 'labMissed', rnd.filter((s) => s.treated && s.cycleStarts.length >= 5));
  dvPick(6, 'ecgMissed', rnd.filter((s) => s.treated && s.cycleStarts.length >= 3));
  dvPick(8, 'visitOow', rnd.filter((s) => s.treated && s.cycleStarts.length >= 6));
  // screening ALT >2.5 x ULN in one randomized subject (eligibility deviation visible in LB)
  dvPick(1, 'altIneligible', rnd.filter((s) => s.treated && s.arm === 'PBO+DOC' && s.cycleStarts.length >= 4));
  // QTcF outliers and a potential Hy's law case
  const qtc = [
    ...pick.sample(rnd.filter((s) => s.treated && s.actualArm === 'CBX+DOC' && s.cycleStarts.length >= 4), 6),
    ...pick.sample(rnd.filter((s) => s.treated && s.actualArm === 'PBO+DOC' && s.cycleStarts.length >= 4), 2),
  ];
  qtc.forEach((s, i) => (s.flags[i < 4 || i === 6 ? 'qtcHigh' : 'qtcInc'] = true));
  qtc[0].flags.qtc500 = true;
  special.qtc = qtc.map((s) => s.subjid);

  for (const s of rnd) {
    const r = stream(seed, `followup/${s.subjid}`);
    applyNact(s, r);
    simulateFollowUp(s, r);
  }
  // missing baseline laboratory samples: 5 subject-tests without a screening result, 2 without screening and C1D1
  const mlSubj = pick.sample(rnd.filter((s) => s.treated && !s.site.localLab), 7);
  const mlCodes = ['ALB', 'ALP', 'CREAT', 'BILI', 'PLAT', 'ALT', 'HGB'];
  mlSubj.forEach((s, i) => {
    s.flags[`missLab:SCR:${mlCodes[i]}`] = true;
    if (i >= 5) s.flags[`missLab:C1D1:${mlCodes[i]}`] = true;
  });
  special.missLab = mlSubj.map((s, i) => `${s.subjid}|${mlCodes[i]}|${i >= 5 ? 'SCR+C1D1' : 'SCR'}`);
  // potential Hy's law case (ALT >3 x ULN with bilirubin >2 x ULN) on CBX-417
  const hy = rnd.find((s) => s.actualArm === 'CBX+DOC' && s.aes.some((a) => a.pt === 'Alanine aminotransferase increased' && a.grade === 3 && a.phase === 'on'));
  if (hy) {
    const alt = hy.aes.find((a) => a.pt === 'Alanine aminotransferase increased' && a.grade === 3)!;
    hy.flags.hysLaw = true;
    const ae = makeAe(pick, 'Blood bilirubin increased', alt.start + 1, 2, { armIdx: 0, phase: 'on', cycle: alt.cycle, acnCbx: 'DRUG INTERRUPTED', acnDoc: 'DOSE NOT CHANGED', docExposed: true, dur: alt.dur });
    ae.relCbx = 'Y';
    hy.aes.push(ae);
    special.hysLaw = [hy.subjid];
  }
  for (const s of rnd) simulateFindings(s, seed);
  special.genuine = markGenuineExtremes(rnd);
  for (const s of rnd) simulateConmeds(s, seed);
  // an item of medical history that the site entered on the AE page (reclassified by query)
  const mhAe = pick.sample(rnd.filter((s) => s.treated && s.consent - s.randDate! < -10), 1)[0];
  mhAe.mhs.push({ verbatim: 'Chronic lower back pain', pt: 'Back pain', soc: 'Musculoskeletal and connective tissue disorders', start: partialOf(mhAe.consent - 62, 'full'), ongoing: true, enteredOnAePage: true });
  special.mhOnAePage = [mhAe.subjid];
  for (const s of rnd) finalizeSubject(s, stream(seed, `finalize/${s.subjid}`));
  special.aePartial = assignAePartials(rnd, pick);
  for (const s of rnd) deviations(s, stream(seed, `dv/${s.subjid}`));
  for (const s of rnd) numberUnscheduled(s);
  for (const s of subjects.filter((x) => x.screenFail)) simulateScreeningFindings(s, seed);

  // AEs with a genuinely missing relationship (never answered by the site)
  const teaes = rnd.flatMap((s) => s.aes.filter((a) => a.phase === 'on' && a.grade < 5).map((a) => ({ s, a })));
  pick.sample(teaes, 3).forEach(({ a }) => (a.relCbx = null));
  if (subjects.length !== N_SCREENED) throw new Error('screened count');
  return { seed, sites, subjects, kits: kits.all(), special };
}

/** Finalize AE end dates / outcomes against the subject's last contact, and last-contact date. */
function finalizeSubject(s: TSubject, r: Rng) {
  const R = s.randDate!;
  const dates: number[] = [R, s.consent];
  for (const x of s.scans) dates.push(x.date);
  for (const x of s.labs) dates.push(x.date);
  for (const x of s.vitals) dates.push(x.date);
  for (const x of s.ecgs) dates.push(x.date);
  for (const x of s.exCbx) dates.push(x.end);
  for (const x of s.exDoc) dates.push(x.date);
  for (const c of s.contacts) if (c.status === 'Alive') dates.push(c.date);
  if (s.eotDate !== null) dates.push(s.eotDate);
  if (s.sfuDate !== null) dates.push(s.sfuDate);
  if (s.withdrawalDate !== null) dates.push(s.withdrawalDate);
  let last = Math.max(...dates.filter((d) => d <= DCO));
  if (s.deathDate !== null) last = Math.min(last, s.deathDate);
  s.lastContact = last;
  const horizon = s.deathDate ?? Math.min(DCO, s.withdrawalDate ?? DCO, s.ltfuDate ?? DCO, Math.max(last, s.lastDose !== null ? s.lastDose + 30 : last));
  for (const a of s.aes) {
    if (a.grade === 5) {
      a.end = s.deathDate;
      a.outcome = 'FATAL';
      continue;
    }
    let end: number | null = a.start + a.dur - 1;
    if (end > horizon || a.ongoingPref) end = null;
    if (end !== null && s.deathDate !== null && end >= s.deathDate) end = null;
    a.end = end;
    if (end === null) {
      if (s.ltfuDate !== null && s.deathDate === null) a.outcome = 'UNKNOWN';
      else a.outcome = s.deathDate === null && r.bool(0.3) ? 'RECOVERING/RESOLVING' : 'NOT RECOVERED/NOT RESOLVED';
    } else a.outcome = a.pt === 'Neuropathy peripheral' && r.bool(0.25) ? 'RECOVERED/RESOLVED WITH SEQUELAE' : 'RECOVERED/RESOLVED';
  }
  s.aes.sort((a, b) => a.start - b.start || a.pt.localeCompare(b.pt));
}


/** Genuine extreme values (source-verified) that data cleaning must NOT remove. */
function markGenuineExtremes(rnd: TSubject[]): string[] {
  const out: string[] = [];
  const within = (a: TAe, d: number) => d >= a.start && d <= a.start + a.dur - 1;
  const labPick = (pt: string, grade: number, code: string, value: number, orig: string) => {
    for (const s of rnd) {
      const a = s.aes.find((x) => x.pt === pt && x.grade === grade && x.phase === 'on');
      if (!a) continue;
      const l = s.labs.filter((x) => x.code === code && !x.local && within(a, x.date)).sort((x, y) => (code === 'ALT' ? y.std - x.std : x.std - y.std))[0];
      if (!l) continue;
      l.std = value;
      l.orig = orig;
      out.push(`LB|${s.subjid}|${code}|${l.date}|${l.time}`);
      return;
    }
  };
  labPick('Alanine aminotransferase increased', 4, 'ALT', 1450, '1450');
  labPick('Neutropenia', 4, 'NEUT', 0.02, '0.02');
  labPick('Thrombocytopenia', 4, 'PLAT', 9, '9');
  for (const s of rnd) {
    const a = s.aes.find((x) => x.pt === 'Hypertension' && x.grade === 3);
    const v = a ? s.vitals.find((x) => within(a, x.date) && x.visitName !== 'SCREENING') : undefined;
    if (!a || !v) continue;
    v.sysbp = 204;
    v.diabp = Math.max(v.diabp, 112);
    out.push(`VS|${s.subjid}|SYSBP|${v.date}|${v.time}`);
    break;
  }
  const heavy = rnd.find((s) => s.weightKg === 131.2);
  if (heavy) out.push(`VS|${heavy.subjid}|WEIGHT|${heavy.vitals[0].date}|${heavy.vitals[0].time}`);
  return out;
}

/** AE dates collected as partial dates (day and/or month unknown). */
function assignAePartials(rnd: TSubject[], r: Rng): string[] {
  const out: string[] = [];
  const same = (a: number, b: number) => ymd(a).y === ymd(b).y && ymd(a).m === ymd(b).m;
  const pre = rnd.flatMap((s) => s.aes.filter((a) => a.phase === 'pre' && s.firstDose !== null && same(a.start, s.firstDose)).map((a) => ({ s, a })));
  const on = rnd.flatMap((s) => s.aes.filter((a) => a.phase === 'on' && a.grade < 5 && s.firstDose !== null && !same(a.start, s.firstDose) && ymd(a.start).y !== ymd(s.firstDose).y).map((a) => ({ s, a })));
  const onAny = rnd.flatMap((s) => s.aes.filter((a) => a.phase === 'on' && a.grade < 5 && s.firstDose !== null && !same(a.start, s.firstDose)).map((a) => ({ s, a })));
  for (const { s, a } of r.sample(pre, Math.min(3, pre.length))) {
    a.startPartial = partialOf(a.start, 'month');
    out.push(`${s.subjid}|${a.pt}|start-month-pre`);
  }
  for (const { s, a } of r.sample(onAny.filter((x) => !x.a.startPartial), 7)) {
    a.startPartial = partialOf(a.start, 'month');
    out.push(`${s.subjid}|${a.pt}|start-month`);
  }
  for (const { s, a } of r.sample(on.filter((x) => !x.a.startPartial), 2)) {
    a.startPartial = partialOf(a.start, 'year');
    out.push(`${s.subjid}|${a.pt}|start-year`);
  }
  const withEnd = rnd.flatMap((s) => s.aes.filter((a) => a.end !== null && a.grade < 5 && !a.startPartial && ymd(a.end!).m !== ymd(a.start).m).map((a) => ({ s, a })));
  for (const { s, a } of r.sample(withEnd, 4)) {
    a.endPartial = partialOf(a.end!, 'month');
    out.push(`${s.subjid}|${a.pt}|end-month`);
  }
  return out;
}

/** Unscheduled VISITNUM = preceding scheduled VISITNUM (same schedule) + 0.01, +0.02 … (study convention). */
function numberUnscheduled(s: TSubject) {
  const sched = [...new Map(s.labs.filter((l) => !l.unscheduled).map((l) => [l.visitNum, l.date])).entries()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const unsDates = [...new Set(s.labs.filter((l) => l.unscheduled).map((l) => l.date))].sort((a, b) => a - b);
  const count = new Map<number, number>();
  const numOf = new Map<number, number>();
  for (const d of unsDates) {
    let prev = 1;
    for (const [n, dd] of sched) if (dd <= d) prev = n;
    const k = (count.get(prev) ?? 0) + 1;
    count.set(prev, k);
    numOf.set(d, Math.round((prev + 0.01 * k) * 100) / 100);
  }
  for (const l of s.labs) if (l.unscheduled) l.visitNum = numOf.get(l.date)!;
  let prevT = 1;
  let k = 0;
  for (const sc of s.scans) {
    if (sc.visitName === 'UNSCHEDULED') {
      k++;
      sc.visitNum = Math.round((prevT + 0.01 * k) * 100) / 100;
    } else {
      prevT = sc.visitNum;
      k = 0;
    }
  }
}
