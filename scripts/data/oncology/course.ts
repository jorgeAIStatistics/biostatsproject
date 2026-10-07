/**
 * Treatment course for treated subjects: 21-day cycles, CBX-417/placebo daily
 * dosing (interruptions, reductions 200 → 150 → 100 mg), docetaxel on Day 1
 * (75 → 60 mg/m2, delays), adverse events simulated cycle by cycle so that AE
 * actions, EX records and the end-of-treatment reason stay consistent.
 */
import { AE_CATALOG, DCO, FATAL_PTS, aeSoc, aeVerbatims, type AeDef, type Profile } from './config.ts';
import { Rng, stream } from './prng.ts';
import { toWeekday } from './dates.ts';
import type { TAe, TExCbx, TExDoc, TSubject } from './types.ts';

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export class KitPool {
  private r: Rng;
  private used = new Set<number>();
  private list: { kit: string; content: 'CBX-417' | 'PLACEBO' }[] = [];
  constructor(seed: number) {
    this.r = stream(seed, 'kits');
  }
  take(content: 'CBX-417' | 'PLACEBO'): string {
    let k = this.r.int(100000, 999999);
    while (this.used.has(k)) k = this.r.int(100000, 999999);
    this.used.add(k);
    this.list.push({ kit: String(k), content });
    return String(k);
  }
  /** All kits (dispensed + unused shipped stock), sorted by kit number. */
  all() {
    const n = Math.round(this.list.length * 0.12);
    for (let i = 0; i < n; i++) this.take(i % 2 === 0 ? 'CBX-417' : 'PLACEBO');
    return [...this.list].sort((a, b) => Number(a.kit) - Number(b.kit));
  }
}

export function planTreatment(s: TSubject, r: Rng) {
  const R = s.randDate!;
  const c1 = toWeekday(R + r.weighted([0, 1, 2, 3], [35, 35, 20, 10]));
  if (s.deathDate !== null && s.deathDate <= c1 + 3) s.deathDate = c1 + r.int(8, 25);
  const cands: [number, string][] = [];
  if (s.pdDate !== null) cands.push([s.pdDate + r.int(0, 3), 'PROGRESSIVE DISEASE']);
  if (s.deathDate !== null) cands.push([s.deathDate - r.int(1, 4), 'DEATH']);
  if (s.withdrawalDate !== null) cands.push([s.withdrawalDate, 'WITHDRAWAL BY SUBJECT']);
  if (r.bool(0.055)) cands.push([R + r.int(50, 420), 'PHYSICIAN DECISION']);
  if (r.bool(0.03)) cands.push([R + r.int(30, 320), 'WITHDRAWAL BY SUBJECT']);
  cands.push([DCO, 'ONGOING']);
  cands.sort((a, b) => a[0] - b[0]);
  const [end0, reason] = cands[0];
  const end = Math.max(c1, Math.min(end0, DCO));
  s.plan = { c1, end, reason, n0: Math.floor((end - c1) / 21) + 1 };
}

function cycleWeights(profile: Profile, n: number): number[] {
  const w: number[] = [];
  for (let c = 1; c <= n; c++) {
    if (profile === 'first') w.push(c === 1 ? 0.7 : c === 2 ? 0.15 : c === 3 ? 0.08 : 0.07 / Math.max(1, n - 3));
    else if (profile === 'early') w.push(Math.exp(-0.45 * (c - 1)));
    else if (profile === 'uniform') w.push(1);
    else w.push(Math.pow(c, 1.2));
  }
  return w;
}

interface Ep {
  def: AeDef;
  cycle: number;
  day: number;
  grade: number;
}

function planEpisodes(s: TSubject, r: Rng, armIdx: number, nRef: number): Ep[] {
  const n0 = s.plan!.n0;
  const eps: Ep[] = [];
  const add = (def: AeDef, forcedCycle?: number, forcedDay?: number) => {
    const cyc = forcedCycle ?? r.weighted(Array.from({ length: n0 }, (_, i) => i + 1), cycleWeights(def.profile, n0));
    const grades = armIdx === 1 && def.gradesPbo ? def.gradesPbo : def.grades;
    const g = r.weighted([1, 2, 3, 4], grades);
    eps.push({ def, cycle: cyc, day: forcedDay ?? r.int(def.day[0], def.day[1]), grade: g });
    let c = cyc;
    for (let k = 0; k < 3; k++) {
      if (!r.bool(def.recur)) break;
      c += r.int(1, 3);
      if (c > n0) break;
      const g2 = clamp(g + r.weighted([-1, 0, 1], [0.35, 0.5, 0.15]), 1, 4);
      eps.push({ def, cycle: c, day: r.int(def.day[0], def.day[1]), grade: g2 });
    }
  };
  for (const def of AE_CATALOG) {
    if (def.pt === 'Aspartate aminotransferase increased') continue;
    const p = def.inc[armIdx];
    let w = 1;
    if (def.profile === 'uniform') w = Math.pow(n0 / nRef, 0.7);
    else if (def.profile === 'late') w = Math.pow(n0 / nRef, 1.1);
    if (!r.bool(1 - Math.pow(1 - p, w))) continue;
    add(def);
  }
  // AST increased mostly co-occurs with ALT increased
  const astDef = AE_CATALOG.find((d) => d.pt === 'Aspartate aminotransferase increased')!;
  const alt = eps.find((e) => e.def.pt === 'Alanine aminotransferase increased');
  const pAst = alt ? (armIdx === 0 ? 0.65 : 0.5) : armIdx === 0 ? 0.04 : 0.02;
  if (r.bool(pAst)) add(astDef, alt?.cycle, alt ? clamp(alt.day + r.int(0, 2), 1, 21) : undefined);
  return eps;
}

function cbxAction(e: Ep, r: Rng): string {
  const g = e.grade;
  if (e.def.pt === 'Pneumonitis') return g >= 3 ? (r.bool(0.85) ? 'DRUG WITHDRAWN' : 'DRUG INTERRUPTED') : r.bool(0.7) ? 'DRUG INTERRUPTED' : 'DRUG WITHDRAWN';
  const W = (xs: [string, number][]) => r.weighted(xs.map((x) => x[0]), xs.map((x) => x[1]));
  const NC = 'DOSE NOT CHANGED';
  switch (e.def.cbxAct) {
    case 'weak':
      if (g <= 2) return NC;
      if (g === 3) return W([['DRUG INTERRUPTED', 30], ['DRUG WITHDRAWN', 4], [NC, 66]]);
      return W([['DRUG INTERRUPTED', 50], ['DOSE REDUCED', 20], ['DRUG WITHDRAWN', 12], [NC, 18]]);
    case 'normal':
      if (g === 1) return NC;
      if (g === 2) return W([[NC, 80], ['DRUG INTERRUPTED', 20]]);
      if (g === 3) return W([['DRUG INTERRUPTED', 50], ['DOSE REDUCED', 24], ['DRUG WITHDRAWN', 15], [NC, 11]]);
      return W([['DRUG INTERRUPTED', 35], ['DRUG WITHDRAWN', 45], ['DOSE REDUCED', 20]]);
    default:
      if (g === 1) return W([[NC, 90], ['DRUG INTERRUPTED', 10]]);
      if (g === 2) return W([[NC, 55], ['DRUG INTERRUPTED', 35], ['DOSE REDUCED', 10]]);
      if (g === 3) return W([['DRUG INTERRUPTED', 42], ['DOSE REDUCED', 33], ['DRUG WITHDRAWN', 21], [NC, 4]]);
      return W([['DRUG WITHDRAWN', 65], ['DRUG INTERRUPTED', 22], ['DOSE REDUCED', 13]]);
  }
}

function docAction(e: Ep, r: Rng): string {
  const g = e.grade;
  const W = (xs: [string, number][]) => r.weighted(xs.map((x) => x[0]), xs.map((x) => x[1]));
  const NC = 'DOSE NOT CHANGED';
  switch (e.def.docAct) {
    case 'none':
      return NC;
    case 'neutro':
      if (e.def.pt === 'Febrile neutropenia') return W([['DOSE REDUCED', 70], ['DRUG WITHDRAWN', 15], ['DRUG INTERRUPTED', 15]]);
      if (g <= 2) return W([[NC, 85], ['DRUG INTERRUPTED', 15]]);
      if (g === 3) return W([['DOSE REDUCED', 35], ['DRUG INTERRUPTED', 35], [NC, 30]]);
      return W([['DOSE REDUCED', 55], ['DRUG INTERRUPTED', 35], ['DRUG WITHDRAWN', 10]]);
    case 'neuro':
      if (g === 1) return NC;
      if (g === 2) return W([['DRUG WITHDRAWN', 45], ['DOSE REDUCED', 35], [NC, 20]]);
      return W([['DRUG WITHDRAWN', 80], ['DOSE REDUCED', 20]]);
    default:
      if (g === 1) return NC;
      if (g === 2) return W([[NC, 88], ['DRUG INTERRUPTED', 12]]);
      if (g === 3) return W([['DRUG INTERRUPTED', 40], ['DOSE REDUCED', 20], ['DRUG WITHDRAWN', 8], [NC, 32]]);
      return W([['DRUG WITHDRAWN', 40], ['DRUG INTERRUPTED', 40], ['DOSE REDUCED', 20]]);
  }
}

const HEME_DOC = new Set(['Neutropenia', 'Febrile neutropenia', 'Leukopenia', 'Thrombocytopenia']);

export function makeAe(
  r: Rng,
  pt: string,
  start: number,
  grade: number,
  o: { armIdx: number; phase: 'pre' | 'on' | 'post'; cycle: number | null; acnCbx: string; acnDoc: string; docExposed: boolean; def?: AeDef; dur?: number },
): TAe {
  const def = o.def ?? AE_CATALOG.find((d) => d.pt === pt);
  const dur = o.dur ?? Math.max(1, Math.round(r.lognormal(def ? def.dur[0] : 10, def ? def.dur[1] : 0.6)));
  const serious = grade === 5 || (def ? r.bool(def.ser[Math.min(grade, 4) - 1]) : grade >= 3 && r.bool(0.4));
  const shosp = serious && (grade === 5 ? r.bool(0.6) : r.bool(0.92));
  const relC = def ? def.relCbx[o.armIdx] : 0.2;
  const relD = def ? def.relDoc : 0.2;
  const ae: TAe = {
    pt,
    soc: aeSoc(pt),
    verbatim: r.pick(aeVerbatims(pt)),
    start,
    end: null,
    grade: grade as TAe['grade'],
    serious,
    sdth: grade === 5,
    slife: serious && grade >= 4 && r.bool(0.5),
    shosp,
    sdisab: serious && grade >= 3 && r.bool(0.01),
    scong: false,
    smie: serious && !shosp && grade < 5,
    relCbx: o.phase === 'pre' ? 'N' : r.bool(relC) ? 'Y' : 'N',
    relDoc: o.phase === 'pre' || !o.docExposed ? 'N' : r.bool(relD) ? 'Y' : 'N',
    acnCbx: o.acnCbx,
    acnDoc: o.acnDoc,
    outcome: '',
    phase: o.phase,
    cycle: o.cycle,
    dur,
  };
  if (def?.ongoing && r.bool(def.ongoing)) ae.ongoingPref = true;
  return ae;
}

const EOT_TEXT: Record<string, string[]> = {
  'PROGRESSIVE DISEASE': ['Disease progression', 'Radiological progression (RECIST 1.1)', 'PD', 'Progressive disease'],
  'ADVERSE EVENT': ['Adverse event', 'Toxicity', 'AE - see AE form'],
  'WITHDRAWAL BY SUBJECT': ['Patient decision', 'Subject withdrew consent', 'Patient request'],
  'PHYSICIAN DECISION': ['Investigator decision - clinical deterioration', 'Physician decision', 'Clinical progression per investigator'],
  DEATH: ['Death', 'Patient died'],
};

export function simulateCourse(s: TSubject, seed: number, meanN: Record<string, number>, kits: KitPool) {
  const r = stream(seed, `course/${s.subjid}`);
  const plan = s.plan!;
  const cbxArm = s.arm === 'CBX+DOC';
  const contentFor = (cycle: number): 'CBX-417' | 'PLACEBO' => {
    if (s.flags.errAllPlacebo) return 'PLACEBO';
    if (s.flags.errCycles2 && cycle === 2) return 'CBX-417';
    if (s.flags.errCycles34 && (cycle === 3 || cycle === 4)) return 'CBX-417';
    return cbxArm ? 'CBX-417' : 'PLACEBO';
  };
  const armIdx = cbxArm && !s.flags.errAllPlacebo ? 0 : 1;
  const episodes = planEpisodes(s, r, armIdx, meanN[s.arm!]);
  const c1 = plan.c1;
  let end = plan.end;
  let endReason = plan.reason;

  // death without documented progression during / shortly after treatment → fatal AE
  let fatal: { pt: string; onset: number } | null = null;
  if (s.deathDate !== null && s.pdDate === null) {
    const d = s.deathDate;
    if (plan.reason === 'DEATH' && r.bool(0.8)) {
      const onset = Math.max(c1 + 1, d - r.int(1, 10));
      fatal = { pt: r.weighted(FATAL_PTS.map((x) => x.pt), FATAL_PTS.map((x) => x.w)), onset };
      end = Math.min(end, Math.max(c1, onset + r.int(0, 1)));
      endReason = 'DEATH';
    } else if (d > plan.end && d <= plan.end + 30 && r.bool(0.5)) {
      fatal = { pt: r.weighted(FATAL_PTS.map((x) => x.pt), FATAL_PTS.map((x) => x.w)), onset: Math.max(plan.end + 1, d - r.int(1, 8)) };
    }
    if (fatal) s.deathCause = 'Adverse event';
  }

  const height = s.heightCm;
  const bsa = Math.round(Math.sqrt((height * s.weightKg) / 3600) * 100) / 100;
  const doseTime0 = r.int(9 * 60 + 15, 12 * 60);
  const cycleStarts: number[] = [];
  const exDoc: TExDoc[] = [];
  const aes: TAe[] = [];
  const gaps: { from: number; to: number; pt: string }[] = [];
  const doseChanges: { from: number; dose: number; pt: string }[] = [];
  let cbxDose = 200;
  let docLevel = 75;
  let docReduced = false;
  let docActive = true;
  const docStopCycle = r.bool(0.35) ? r.int(4, 9) : 999;
  let docReason: string | null = null;
  let cs = c1;
  let n = 1;
  while (cs <= end && cs <= DCO) {
    cycleStarts.push(cs);
    let docGiven = false;
    if (docActive && n <= docStopCycle) {
      const time = n === 1 ? doseTime0 + r.int(30, 120) : r.int(9 * 60, 14 * 60);
      exDoc.push({ cycle: n, date: cs, time, bsa, level: docLevel, doseMg: Math.round(docLevel * bsa), reason: docReason });
      docGiven = true;
      docReason = null;
    } else if (docActive) {
      docActive = false;
      s.flags.docStoppedCumulative = true;
    }
    let delay = 0;
    const eps = episodes.filter((e) => e.cycle === n).sort((a, b) => a.day - b.day);
    for (const e of eps) {
      const onset = cs + e.day - 1;
      if (onset > DCO || (s.deathDate !== null && onset >= s.deathDate) || (s.withdrawalDate !== null && onset >= s.withdrawalDate)) continue;
      if (HEME_DOC.has(e.def.pt) && !docGiven) continue;
      if (fatal && onset >= fatal.onset) continue;
      const onTrt = onset <= end;
      let acnCbx = 'NOT APPLICABLE';
      let acnDoc = 'NOT APPLICABLE';
      if (onTrt) {
        acnCbx = cbxAction(e, r);
        if (acnCbx === 'DOSE REDUCED' && cbxDose === 100) acnCbx = 'DRUG WITHDRAWN';
        if (docActive && n <= docStopCycle) {
          acnDoc = docAction(e, r);
          if (acnDoc === 'DOSE REDUCED' && docReduced) acnDoc = 'DRUG WITHDRAWN';
        }
        const pt = e.def.pt.toLowerCase();
        if (acnCbx === 'DRUG INTERRUPTED') {
          const from = onset + r.int(0, 2);
          const len = clamp(Math.round(e.def.dur[0] * r.unif(0.6, 1.2)), 3, 21);
          if (from <= end) gaps.push({ from, to: from + len - 1, pt });
        } else if (acnCbx === 'DOSE REDUCED') {
          const from = onset + r.int(0, 2);
          let resume = from;
          if (e.grade >= 3) {
            const len = r.int(3, 10);
            gaps.push({ from, to: from + len - 1, pt });
            resume = from + len;
          }
          cbxDose = cbxDose === 200 ? 150 : 100;
          doseChanges.push({ from: resume, dose: cbxDose, pt });
        } else if (acnCbx === 'DRUG WITHDRAWN') {
          const stopAt = onset + r.int(0, 2);
          if (stopAt < end) {
            end = Math.max(cs, stopAt);
            endReason = 'ADVERSE EVENT';
          }
        }
        if (acnDoc === 'DOSE REDUCED') {
          docLevel = 60;
          docReduced = true;
          docReason = `Dose reduced to 60 mg/m2 due to ${pt}`;
        } else if (acnDoc === 'DRUG INTERRUPTED') {
          delay = Math.max(delay, 7);
          docReason = docReason ?? `Cycle delayed 1 week due to ${pt}`;
        } else if (acnDoc === 'DRUG WITHDRAWN') docActive = false;
      }
      aes.push(makeAe(r, e.def.pt, onset, e.grade, { armIdx, phase: 'on', cycle: n, acnCbx, acnDoc, docExposed: exDoc.length > 0, def: e.def }));
    }
    let jit = 0;
    const u = r.next();
    if (u < 0.15) jit = r.int(1, 3);
    else if (u < 0.2) jit = -r.int(1, 2);
    const next = toWeekday(cs + 21 + delay + jit);
    if (next > end) break;
    cs = next;
    n++;
  }

  // CBX-417 / placebo dosing records (one per constant-dose interval within a cycle)
  const ongoing = endReason === 'ONGOING';
  const exCbx: TExCbx[] = [];
  let lastRecDose = 200;
  for (let i = 0; i < cycleStarts.length; i++) {
    const a = cycleStarts[i];
    let b = i + 1 < cycleStarts.length ? cycleStarts[i + 1] - 1 : ongoing ? Math.min(DCO, a + 20) : end;
    b = Math.min(b, end, DCO);
    const content = contentFor(i + 1);
    const kit = kits.take(content);
    let cur: TExCbx | null = null;
    let pendingReason: string | null = null;
    for (let d = a; d <= b; d++) {
      const gap = gaps.find((g) => d >= g.from && d <= g.to);
      let dose = 200;
      let dosePt = '';
      for (const ch of doseChanges)
        if (ch.from <= d) {
          dose = ch.dose;
          dosePt = ch.pt;
        }
      if (gap) {
        if (cur) {
          exCbx.push(cur);
          cur = null;
        }
        pendingReason = `Resumed after interruption for ${gap.pt}`;
        continue;
      }
      if (!cur || cur.dose !== dose) {
        if (cur) exCbx.push(cur);
        let reason: string | null = pendingReason;
        if (dose < lastRecDose) reason = `Dose reduced to ${dose} mg due to ${dosePt}`;
        cur = { cycle: i + 1, kit, content, start: d, end: d, dose, reason, time: i === 0 && d === c1 ? doseTime0 : null };
        pendingReason = null;
        lastRecDose = dose;
      } else cur.end = d;
    }
    if (cur) exCbx.push(cur);
  }
  s.exCbx = exCbx;
  s.exDoc = exDoc.filter((x) => x.date <= end);
  s.cycleStarts = cycleStarts;
  s.firstDose = c1;
  s.firstDoseTime = doseTime0;
  s.lastDose = Math.max(exCbx.length ? exCbx[exCbx.length - 1].end : c1, s.exDoc.length ? s.exDoc[s.exDoc.length - 1].date : c1);
  const anyCbx = exCbx.some((x) => x.content === 'CBX-417');
  s.actualArm = anyCbx ? 'CBX+DOC' : 'PBO+DOC';
  if (s.flags.errCycles2) {
    s.unplanned = 'Placebo + Docetaxel 75 mg/m2; CBX-417 200 mg kit dispensed in error for Cycle 2';
    s.dispensingError = 'Kit containing CBX-417 dispensed at Cycle 2 to a subject randomized to placebo (IxRS kit/arm mismatch)';
  }
  if (s.flags.errCycles34) {
    s.unplanned = 'Placebo + Docetaxel 75 mg/m2; CBX-417 200 mg kits dispensed in error for Cycles 3-4';
    s.dispensingError = 'Kits containing CBX-417 dispensed at Cycles 3 and 4 to a subject randomized to placebo (IxRS kit/arm mismatch)';
  }
  if (s.flags.errAllPlacebo) s.dispensingError = 'Placebo kits dispensed at all cycles to a subject randomized to CBX-417 (IxRS kit/arm mismatch)';

  if (ongoing) {
    s.eotReason = null;
  } else {
    s.eotReason = endReason;
    s.eotReasonText = r.pick(EOT_TEXT[endReason]);
    if (endReason === 'ADVERSE EVENT') {
      const w = aes.find((a) => a.acnCbx === 'DRUG WITHDRAWN');
      if (w) s.eotReasonText = `Adverse event: ${w.verbatim}`;
    }
    const eot = toWeekday(s.lastDose + r.int(1, 7));
    const blocked = endReason === 'DEATH' || (s.withdrawalDate !== null && endReason === 'WITHDRAWAL BY SUBJECT' && s.withdrawalDate <= s.lastDose + 1);
    if (!blocked && eot <= DCO && (s.deathDate === null || eot < s.deathDate) && (s.withdrawalDate === null || eot < s.withdrawalDate)) s.eotDate = eot;
    else s.eotDate = null;
  }

  // fatal AE
  if (fatal && fatal.onset <= DCO) {
    const onTrt = fatal.onset <= s.lastDose;
    aes.push(
      makeAe(r, fatal.pt, fatal.onset, 5, {
        armIdx,
        phase: fatal.onset <= s.lastDose + 30 ? 'on' : 'post',
        cycle: null,
        acnCbx: onTrt ? 'DRUG WITHDRAWN' : 'NOT APPLICABLE',
        acnDoc: onTrt && s.exDoc.length && s.exDoc[s.exDoc.length - 1].date >= s.lastDose - 21 ? 'DRUG WITHDRAWN' : 'NOT APPLICABLE',
        docExposed: true,
        dur: s.deathDate! - fatal.onset + 1,
      }),
    );
  }
  // AEs that started between consent and first dose (not treatment-emergent)
  if (r.bool(0.1) && c1 - s.consent > 3) {
    const k = r.bool(0.8) ? 1 : 2;
    for (let i = 0; i < k; i++) {
      const pt = r.pick(['Cough', 'Back pain', 'Fatigue', 'Dyspnea', 'Constipation', 'Insomnia', 'Anemia', 'Headache', 'Nausea']);
      const onset = r.int(s.consent + 1, c1 - 1);
      aes.push(makeAe(r, pt, onset, r.bool(0.7) ? 1 : 2, { armIdx, phase: 'pre', cycle: null, acnCbx: 'NOT APPLICABLE', acnDoc: 'NOT APPLICABLE', docExposed: false }));
    }
  }
  // AEs starting more than 30 days after the last dose (collected SAEs / follow-up AEs)
  if (s.eotReason !== null && r.bool(0.045)) {
    const onset = s.lastDose + r.int(31, 150);
    const ok = onset <= DCO && (s.deathDate === null || onset < s.deathDate) && (s.withdrawalDate === null || onset < s.withdrawalDate);
    if (ok) {
      const pt = r.weighted(['Pneumonia', 'Dyspnea', 'Fatigue', 'Pleural effusion', 'Anemia', 'Back pain'], [0.3, 0.2, 0.15, 0.15, 0.1, 0.1]);
      aes.push(makeAe(r, pt, onset, r.bool(0.5) ? 2 : 3, { armIdx, phase: 'post', cycle: null, acnCbx: 'NOT APPLICABLE', acnDoc: 'NOT APPLICABLE', docExposed: true }));
    }
  }
  s.aes = aes;
}
