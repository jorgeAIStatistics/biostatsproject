/**
 * Laboratory, vital-sign, ECG and ECOG values per visit, consistent with the
 * subject's AEs (e.g. neutropenia AEs ↔ low NEUT, ALT increased ↔ high ALT,
 * hypertension ↔ higher SBP) and with docetaxel nadir timing.
 */
import { C1D8, CHEM_CODES, DCO, HEME_CODES, LAB, LAB_TESTS, VISIT, cycleVisit } from './config.ts';
import { Rng, stream } from './prng.ts';
import { toWeekday } from './dates.ts';
import { makeAe } from './course.ts';
import type { TAe, TEcg, TLab, TSubject, TVitals } from './types.ts';

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const rnd = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

interface Base {
  neut: number;
  lymph: number;
  hgb: number;
  plat: number;
  alt: number;
  ast: number;
  alp: number;
  bili: number;
  creat: number;
  alb: number;
  sbp: number;
  dbp: number;
  pulse: number;
  temp: number;
  qtc: number;
  hr: number;
}

function baseOf(s: TSubject, r: Rng): Base {
  const m = s.sex === 'M';
  return {
    neut: clamp(r.lognormal(4.4, 0.3), 2.0, 9.5),
    lymph: r.unif(0.9, 2.2),
    hgb: clamp(r.norm(m ? 129 : 119, m ? 13 : 11), 92, 172),
    plat: clamp(r.lognormal(255, 0.28), 150, 520),
    alt: clamp(r.lognormal(m ? 23 : 18, 0.33), 7, 46),
    ast: clamp(r.lognormal(m ? 22 : 20, 0.28), 11, 38),
    alp: clamp(r.lognormal(92, 0.33), 38, 320),
    bili: clamp(r.lognormal(8, 0.33), 3, 19),
    creat: clamp(r.lognormal(m ? 80 : 64, 0.18), m ? 55 : 42, m ? 118 : 95),
    alb: clamp(r.norm(38.5, 3.8), 29, 48),
    sbp: clamp(r.norm(128, 14), 96, 172),
    dbp: clamp(r.norm(77, 8), 56, 98),
    pulse: clamp(r.norm(80, 11), 54, 112),
    temp: clamp(r.norm(36.6, 0.2), 36.1, 37.2),
    qtc: clamp(r.norm(412, 15), 372, 446),
    hr: clamp(r.norm(78, 11), 52, 110),
  };
}

type Visit = { name: string; num: number; date: number; time: number; kind: 'SCR' | 'C1D1' | 'C1D8' | 'CYC' | 'EOT' | 'SFU' | 'UNS'; cycle: number };

function activeGrade(s: TSubject, pts: string[], day: number): number {
  let g = 0;
  for (const a of s.aes) if (pts.includes(a.pt) && day >= a.start && day <= a.start + a.dur - 1) g = Math.max(g, a.grade);
  return g;
}

function inRange(r: Rng, lo: number, hi: number) {
  return r.unif(lo, hi);
}

function labValues(s: TSubject, b: Base, v: Visit, r: Rng): Record<string, number> {
  const day = v.date;
  const uln = (c: string) => LAB[c].ref[s.sex][1];
  const lln = (c: string) => LAB[c].ref[s.sex][0];
  const onTrt = s.firstDose !== null && day > s.firstDose;
  const cyclesSince = s.firstDose !== null ? Math.max(0, (day - s.firstDose) / 21) : 0;
  const lastInf = [...s.exDoc].reverse().find((x) => x.date <= day && x.date < day);
  const since = lastInf ? day - lastInf.date : null;
  const nadir = since !== null && since >= 5 && since <= 12;
  const cbx = onTrt && s.actualArm === 'CBX+DOC' && s.lastDose !== null && day <= s.lastDose + 14;
  const out: Record<string, number> = {};
  // neutrophils / WBC
  let neut = b.neut * r.lognormal(1, 0.12);
  if (nadir) neut *= r.unif(0.3, 0.72);
  else if (since !== null && since <= 25) neut *= r.unif(0.85, 1.3);
  const gN = activeGrade(s, ['Neutropenia', 'Febrile neutropenia'], day);
  const ranges: Record<number, [number, number]> = { 1: [1.5, 1.79], 2: [1.0, 1.49], 3: [0.5, 0.99], 4: [0.06, 0.49] };
  if (gN) neut = inRange(r, ...ranges[activeGrade(s, ['Febrile neutropenia'], day) ? (r.bool(0.6) ? 4 : 3) : gN]);
  else if (nadir) neut = Math.max(neut, r.unif(1.02, 1.6));
  else neut = Math.max(neut, r.unif(1.5, 2.0));
  let wbc = neut + b.lymph * r.lognormal(1, 0.12) + r.unif(0.35, 0.8);
  const gL = activeGrade(s, ['Leukopenia'], day);
  if (gL) {
    const wr: Record<number, [number, number]> = { 1: [3.0, 3.9], 2: [2.0, 2.9], 3: [1.0, 1.9], 4: [0.6, 0.99] };
    wbc = inRange(r, ...wr[gL]);
    neut = Math.min(neut, wbc - r.unif(0.3, 0.5));
    if (neut < 0.05) neut = 0.05;
  }
  out.NEUT = rnd(neut, 2);
  out.WBC = rnd(Math.max(wbc, neut + 0.3), 2);
  // hemoglobin
  let hgb = b.hgb - Math.min(14, 2.2 * cyclesSince) + r.norm(0, 3.5);
  const gA = activeGrade(s, ['Anemia'], day);
  if (gA) {
    const ar: Record<number, [number, number]> = { 1: [100, lln('HGB') - 2], 2: [80, 99], 3: [66, 79], 4: [58, 65] };
    hgb = inRange(r, ...ar[gA]);
  } else hgb = Math.max(hgb, 101);
  out.HGB = Math.round(clamp(hgb, 55, 185));
  // platelets
  let plat = b.plat * (nadir ? 0.82 : 1) * r.lognormal(1, 0.1);
  const gP = activeGrade(s, ['Thrombocytopenia'], day);
  if (gP) {
    const pr: Record<number, [number, number]> = { 1: [76, 148], 2: [50, 74], 3: [25, 49], 4: [9, 24] };
    plat = inRange(r, ...pr[gP]);
  } else plat = Math.max(plat, 152);
  out.PLAT = Math.round(plat);
  // liver
  const gAlt = activeGrade(s, ['Alanine aminotransferase increased'], day);
  const gAst = activeGrade(s, ['Aspartate aminotransferase increased'], day);
  const lr: Record<number, [number, number]> = { 1: [1.15, 2.85], 2: [3.1, 4.8], 3: [5.3, 13], 4: [20.5, 30] };
  let alt = b.alt * r.lognormal(1, 0.15) * (cbx ? 1.12 : 1);
  if (gAlt) alt = uln('ALT') * inRange(r, ...lr[gAlt]);
  else if (gAst) alt = b.alt * 1.35;
  else alt = Math.min(alt, uln('ALT') * 0.98);
  let ast = b.ast * r.lognormal(1, 0.13);
  if (gAst) ast = uln('AST') * inRange(r, ...lr[gAst]);
  else if (gAlt) ast = Math.min(alt * 0.55, uln('AST') * 2.8);
  else ast = Math.min(ast, uln('AST') * 0.98);
  out.ALT = Math.round(alt);
  out.AST = Math.round(ast);
  out.ALP = Math.round(b.alp * r.lognormal(1, 0.1) * (gAlt ? 1.3 : 1));
  let bili = b.bili * r.lognormal(1, 0.15);
  const gB = activeGrade(s, ['Blood bilirubin increased'], day);
  if (gB) bili = uln('BILI') * inRange(r, ...({ 1: [1.1, 1.45], 2: [1.6, 2.9], 3: [3.1, 6], 4: [10.5, 12] } as Record<number, [number, number]>)[gB]);
  else bili = Math.min(bili, uln('BILI') * 0.97);
  if (s.flags.hysLaw && gAlt) bili = uln('BILI') * r.unif(2.15, 2.7);
  out.BILI = Math.round(bili);
  out.CREAT = Math.round(b.creat * r.lognormal(1, 0.06) * (activeGrade(s, ['Dehydration'], day) ? 1.45 : 1));
  let alb = b.alb - 0.25 * cyclesSince + r.norm(0, 1.3);
  if (activeGrade(s, ['Hypoalbuminemia'], day)) alb = r.unif(26, 33);
  out.ALB = Math.round(clamp(alb, 22, 52));
  if (s.flags.altIneligible && v.kind === 'SCR') out.ALT = Math.round(uln('ALT') * 2.7);
  return out;
}

function toLab(s: TSubject, v: Visit, code: string, std: number, local: boolean, accession: string): TLab {
  const t = LAB[code];
  const [lo, hi] = local ? t.local.ref[s.sex] : t.ref[s.sex];
  if (local) {
    const f = t.local.factor;
    const origNum = rnd(std / f, t.local.dp);
    const stdConv = f === 1 ? origNum : rnd(origNum * f, t.dp + 1);
    return {
      visitName: v.name, visitNum: v.num, unscheduled: v.kind === 'UNS', date: v.date, time: v.time, code, local: true,
      orig: origNum.toFixed(t.local.dp), origUnit: t.local.unit, origLo: lo.toFixed(t.local.dp), origHi: hi.toFixed(t.local.dp),
      std: stdConv, stdLo: f === 1 ? lo : rnd(lo * f, t.dp + 1), stdHi: f === 1 ? hi : rnd(hi * f, t.dp + 1), accession,
    };
  }
  return {
    visitName: v.name, visitNum: v.num, unscheduled: v.kind === 'UNS', date: v.date, time: v.time, code, local: false,
    orig: std.toFixed(t.dp), origUnit: t.unit, origLo: String(lo), origHi: String(hi), std, stdLo: lo, stdHi: hi, accession,
  };
}

function accession(r: Rng, local: boolean) {
  return local ? `LL${r.int(1000000, 9999999)}` : `CL${r.int(10000000, 99999999)}`;
}

export function simulateFindings(s: TSubject, seed: number) {
  const r = stream(seed, `findings/${s.subjid}`);
  const b = baseOf(s, r);
  if (s.flags.qtcHigh) b.qtc = r.unif(428, 438);
  if (s.flags.qtc500) b.qtc = 441;
  const visits: Visit[] = [{ name: VISIT.SCREENING.name, num: VISIT.SCREENING.num, date: s.screenDate, time: r.int(8 * 60, 11 * 60 + 30), kind: 'SCR', cycle: 0 }];
  if (s.treated) {
    s.cycleStarts.forEach((cs, i) => {
      const cv = cycleVisit(i + 1);
      const time = i === 0 ? Math.max(7 * 60, s.firstDoseTime! - r.int(40, 150)) : r.int(7 * 60 + 30, 10 * 60 + 30);
      visits.push({ name: cv.name, num: cv.num, date: cs, time, kind: i === 0 ? 'C1D1' : 'CYC', cycle: i + 1 });
      if (i === 0) {
        const d8 = toWeekday(cs + 7 + r.int(-1, 1));
        if (d8 <= DCO && (s.lastDose === null || d8 <= s.lastDose + 7) && (s.deathDate === null || d8 < s.deathDate))
          visits.push({ name: C1D8.name, num: C1D8.num, date: d8, time: r.int(8 * 60, 11 * 60), kind: 'C1D8', cycle: 1 });
      }
    });
    if (s.eotDate !== null) visits.push({ name: VISIT.EOT.name, num: VISIT.EOT.num, date: s.eotDate, time: r.int(8 * 60, 12 * 60), kind: 'EOT', cycle: 0 });
    if (s.sfuDate !== null) visits.push({ name: VISIT.SFU.name, num: VISIT.SFU.num, date: s.sfuDate, time: r.int(8 * 60, 12 * 60), kind: 'SFU', cycle: 0 });
  }
  const local = s.site.localLab;
  // ---- labs ----
  const labs: TLab[] = [];
  const labDates: number[] = [];
  let lastDraw = -Infinity;
  for (const v of visits) {
    if (s.flags.labMissed && v.kind === 'CYC' && v.cycle === 3) continue;
    // protocol (educational simplification): laboratory panel on Day 1 of every other cycle
    // EOT laboratory tests are not repeated if a draw was done in the previous 7 days
    if (v.kind === 'CYC' && v.cycle > 1 && v.cycle % 2 === 1) continue;
    if (v.kind === 'EOT' && v.date - lastDraw <= 7) continue;
    lastDraw = v.date;
    const codes = v.kind === 'C1D8' ? HEME_CODES : LAB_TESTS.map((t) => t.code);
    const vals = labValues(s, b, v, r);
    const isLocal = local && v.kind === 'C1D8';
    const acc = accession(r, isLocal);
    for (const c of codes) labs.push(toLab(s, v, c, vals[c], isLocal, acc));
    labDates.push(v.date);
  }
  // unscheduled draws at the onset of lab-type AEs (if no scheduled draw within 3 days)
  const heme = new Set(['Neutropenia', 'Febrile neutropenia', 'Leukopenia', 'Thrombocytopenia', 'Anemia']);
  const liver = new Set(['Alanine aminotransferase increased', 'Aspartate aminotransferase increased', 'Blood bilirubin increased']);
  for (const a of s.aes) {
    if (a.phase === 'pre' || (!heme.has(a.pt) && !liver.has(a.pt))) continue;
    if (labDates.some((d) => Math.abs(d - a.start) <= 3)) continue;
    const d = toWeekday(a.start);
    if (d > DCO || (s.deathDate !== null && d >= s.deathDate)) continue;
    const v: Visit = { name: 'UNSCHEDULED', num: 0, date: d, time: r.int(8 * 60, 16 * 60), kind: 'UNS', cycle: 0 };
    const vals = labValues(s, b, v, r);
    const acc = accession(r, local);
    for (const c of heme.has(a.pt) ? HEME_CODES : CHEM_CODES) labs.push(toLab(s, v, c, vals[c], local, acc));
    labDates.push(d);
  }
  // missing baseline samples (flags set by truth.ts)
  for (const key of Object.keys(s.flags)) {
    const m = key.match(/^missLab:(SCR|C1D1):(\w+)$/);
    if (!m || !s.flags[key]) continue;
    const kind = m[1] === 'SCR' ? 'SCREENING' : 'CYCLE 1 DAY 1';
    const l = labs.find((x) => x.visitName === kind && x.code === m[2]);
    if (l) l.notDone = true;
  }
  labs.sort((a, b2) => a.date - b2.date || a.time - b2.time || LAB_TESTS.findIndex((t) => t.code === a.code) - LAB_TESTS.findIndex((t) => t.code === b2.code));
  s.labs = labs;

  // ---- vitals + ECOG ----
  const vitals: TVitals[] = [];
  const cbxOn = (d: number) => s.actualArm === 'CBX+DOC' && s.firstDose !== null && d > s.firstDose + 10 && s.lastDose !== null && d <= s.lastDose + 10;
  const cbxShift = r.norm(4, 3);
  let prevEcog = s.ecog;
  for (const v of visits) {
    if (v.kind === 'C1D8' || v.kind === 'UNS') continue;
    if (v.kind === 'CYC' && v.cycle > 1 && v.cycle % 2 === 1) continue;
    const d = v.date;
    const gH = activeGrade(s, ['Hypertension'], d);
    const fever = activeGrade(s, ['Pyrexia', 'Febrile neutropenia', 'Pneumonia', 'Sepsis', 'Urinary tract infection'], d) > 0;
    let sbp = b.sbp + (cbxOn(d) ? cbxShift : 0) + r.norm(0, 7);
    let dbp = b.dbp + (cbxOn(d) ? cbxShift / 2 : 0) + r.norm(0, 5);
    if (gH) {
      sbp += gH >= 3 ? r.unif(30, 45) : r.unif(14, 28);
      dbp += gH >= 3 ? r.unif(12, 20) : r.unif(6, 12);
    }
    const wLoss = activeGrade(s, ['Diarrhea', 'Decreased appetite', 'Weight decreased', 'Dehydration'], d) ? r.unif(1.5, 4) : 0;
    const days = s.firstDose !== null ? Math.max(0, d - s.firstDose) : 0;
    const weight = s.weightKg - 0.012 * days - wLoss - (s.pdDate !== null && d >= s.pdDate ? 1.5 : 0) + (v.kind === 'SCR' ? 0 : r.norm(0, 0.6));
    let ecog: number | null = null;
    if (v.kind !== 'SFU') {
      let e = v.kind === 'SCR' ? s.ecog : prevEcog;
      if (v.kind !== 'SCR') {
        if (s.pdDate !== null && d >= s.pdDate - 42 && r.bool(0.35)) e = s.ecog + 1;
        if (v.kind === 'EOT' && s.eotReason === 'PROGRESSIVE DISEASE' && r.bool(0.5)) e = Math.max(e, s.ecog + 1);
        if (r.bool(0.05)) e += r.bool(0.5) ? 1 : -1;
      }
      ecog = clamp(e, 0, 3);
      prevEcog = v.kind === 'SCR' ? s.ecog : ecog;
    }
    vitals.push({
      visitName: v.name, visitNum: v.num, date: d, time: v.kind === 'C1D1' ? Math.max(7 * 60, s.firstDoseTime! - r.int(20, 60)) : v.time + r.int(0, 30),
      sysbp: Math.round(clamp(sbp, 85, 215)), diabp: Math.round(clamp(dbp, 45, 125)),
      pulse: Math.round(clamp(b.pulse + r.norm(0, 6) + (fever ? 12 : 0), 48, 135)),
      temp: rnd(fever ? r.unif(38.0, 39.3) : b.temp + r.norm(0, 0.2), 1),
      weight: rnd(weight, 1), height: v.kind === 'SCR' ? s.heightCm : null, ecog,
    });
  }
  s.vitals = vitals;

  // ---- ECG ----
  const ecgs: TEcg[] = [];
  const cbxQt = s.actualArm === 'CBX+DOC' ? r.norm(8, 5) : r.norm(1, 5);
  const bump = s.flags.qtcHigh || s.flags.qtcInc ? r.unif(62, 80) : 0;
  const bumpAt = r.bool(0.5) ? 2 : 4;
  for (const v of visits) {
    const isEcgVisit = v.kind === 'SCR' || v.kind === 'C1D1' || (v.kind === 'CYC' && (v.cycle === 2 || v.cycle === 4)) || v.kind === 'EOT';
    if (!isEcgVisit) continue;
    if (s.flags.ecgMissed && v.kind === 'CYC' && v.cycle === 2) continue;
    let qtc = b.qtc + r.norm(0, 7);
    if (v.kind !== 'SCR') qtc += v.kind === 'C1D1' ? cbxQt * 0.7 : cbxQt;
    if (v.kind === 'CYC' && v.cycle === bumpAt) qtc = b.qtc + bump + (s.flags.qtc500 ? 72 - bump : 0);
    if (v.kind === 'CYC' && v.cycle === 4 && bumpAt === 2 && bump) qtc = b.qtc + bump * 0.7;
    const time = v.kind === 'C1D1' ? s.firstDoseTime! + r.int(60, 240) : v.time + r.int(10, 40);
    const q = Math.round(qtc);
    const interp = q > 480 ? 'Abnormal, clinically significant' : r.bool(0.12) ? 'Abnormal, not clinically significant' : 'Normal';
    ecgs.push({ visitName: v.name, visitNum: v.num, date: v.date, time, qtcf: q, hr: Math.round(clamp(b.hr + r.norm(0, 6), 45, 130)), interp });
    if (q > 480 && v.kind !== 'SCR' && !s.aes.some((a) => a.pt === 'Electrocardiogram QT prolonged')) {
      const g = q > 500 ? 3 : 2;
      const ae: TAe = makeAe(r, 'Electrocardiogram QT prolonged', v.date, g, {
        armIdx: s.actualArm === 'CBX+DOC' ? 0 : 1, phase: 'on', cycle: v.cycle, acnCbx: g === 3 ? 'DRUG INTERRUPTED' : 'DOSE NOT CHANGED', acnDoc: 'DOSE NOT CHANGED', docExposed: true, dur: r.int(8, 30),
      });
      ae.relCbx = r.bool(0.7) ? 'Y' : 'N';
      s.aes.push(ae);
    }
  }
  s.ecgs = ecgs;
}

/** Screening vitals and labs for screen failures (raw data only; not mapped to SDTM findings). */
export function simulateScreeningFindings(s: TSubject, seed: number) {
  const r = stream(seed, `findings/${s.subjid}`);
  const b = baseOf(s, r);
  const v: Visit = { name: VISIT.SCREENING.name, num: 1, date: s.screenDate, time: r.int(8 * 60, 11 * 60 + 30), kind: 'SCR', cycle: 0 };
  const vals = labValues(s, b, v, r);
  if (s.sfReason?.includes('organ function')) {
    const k = r.int(0, 2);
    if (k === 0) vals.ALT = Math.round(LAB.ALT.ref[s.sex][1] * r.unif(2.8, 4.5));
    else if (k === 1) vals.CREAT = Math.round(LAB.CREAT.ref[s.sex][1] * r.unif(1.6, 2.2));
    else vals.BILI = Math.round(LAB.BILI.ref[s.sex][1] * r.unif(1.7, 2.5));
  }
  const acc = accession(r, false);
  s.labs = s.sfReason?.includes('Withdrew consent') ? [] : LAB_TESTS.map((t) => toLab(s, v, t.code, vals[t.code], false, acc));
  s.vitals = [
    {
      visitName: v.name, visitNum: 1, date: v.date, time: v.time + 20, sysbp: Math.round(b.sbp), diabp: Math.round(b.dbp), pulse: Math.round(b.pulse),
      temp: rnd(b.temp, 1), weight: s.weightKg, height: s.heightCm, ecog: s.ecog,
    },
  ];
}
