/**
 * Medical history and prior / concomitant / subsequent medications.
 * Drug names are generic; classes are ATC-like text (no WHO Drug codes).
 */
import { AE_MEDS, CM_CATALOG, DCO, MH_CATALOG } from './config.ts';
import { Rng, stream } from './prng.ts';
import { partialOf, toWeekday, type PartialDate } from './dates.ts';
import type { TCm, TMh, TSubject } from './types.ts';

const full = (d: number): PartialDate => partialOf(d, 'full');

export function subsequentTherapyName(s: TSubject, r: Rng): string {
  if (!s.priorIO && r.bool(0.5)) return 'NIVOLUMAB';
  return r.weighted(
    ['GEMCITABINE', 'VINORELBINE', 'PEMETREXED', 'INVESTIGATIONAL DRUG', 'CARBOPLATIN + GEMCITABINE'],
    [0.35, 0.25, s.histol === 'NON-SQUAMOUS' ? 0.12 : 0, 0.15, 0.13],
  );
}

function cm(name: string, r: Rng, o: Partial<TCm> & { start: PartialDate; category: TCm['category']; indication: string }): TCm {
  const d = CM_CATALOG[name];
  if (!d) throw new Error(`unknown CM ${name}`);
  return {
    name,
    verbatim: r.pick(d.verbatims),
    indication: o.indication,
    dose: o.dose !== undefined ? o.dose : d.dose,
    unit: o.unit !== undefined ? o.unit : d.unit,
    route: o.route ?? d.route,
    freq: o.freq !== undefined ? o.freq : d.freq,
    start: o.start,
    end: o.end ?? null,
    ongoing: o.ongoing ?? o.end === undefined,
    category: o.category,
  };
}

/** Degrade a date to month or year precision with the given probabilities. */
function maybePartial(day: number, r: Rng, pMonth: number, pYear: number): PartialDate {
  const u = r.next();
  return partialOf(day, u < pYear ? 'year' : u < pYear + pMonth ? 'month' : 'full');
}

export function simulateConmeds(s: TSubject, seed: number) {
  const r = stream(seed, `conmed/${s.subjid}`);
  const consent = s.consent;
  // ---- medical history ----
  const mhs: TMh[] = [];
  const mhMeds: { med: string; start: PartialDate; startDay: number; pt: string }[] = [];
  for (const d of MH_CATALOG) {
    if (d.male && s.sex !== 'M') continue;
    let p = d.p;
    if (d.pt === 'Hypothyroidism') p = s.priorIO ? 0.13 : 0.03;
    if (d.pt === 'Neuropathy peripheral') p = s.priorLines >= 2 ? 0.12 : 0.06;
    if (!r.bool(p)) continue;
    const startDay = consent - Math.round(r.unif(d.years[0] + 0.1, d.years[1]) * 365.25);
    const start = maybePartial(startDay, r, 0.35, 0.2);
    mhs.push({ verbatim: r.pick(d.verbatims), pt: d.pt, soc: d.soc, start, ongoing: r.bool(0.87) });
    if (d.meds.length && r.bool(0.75)) mhMeds.push({ med: r.pick(d.meds), start, startDay, pt: d.pt });
  }
  s.mhs = mhs;

  // ---- prior cancer therapy ----
  const cms: TCm[] = [];
  const window = consent - 28 - (s.diagDay + 14);
  const lines = s.priorLines;
  const ioLine1 = s.priorIO && r.bool(0.8);
  let t = s.diagDay + r.int(14, 40);
  for (let line = 1; line <= lines; line++) {
    const len = Math.max(40, Math.round((window / lines) * r.unif(0.55, 0.85)));
    const st = t;
    const en = Math.min(st + len, consent - 28);
    let drugs: string[];
    if (line === 1) {
      drugs = s.histol === 'SQUAMOUS' ? ['CARBOPLATIN', 'PACLITAXEL'] : [r.bool(0.8) ? 'CARBOPLATIN' : 'CISPLATIN', 'PEMETREXED'];
      if (ioLine1) drugs.push(r.weighted(['PEMBROLIZUMAB', 'ATEZOLIZUMAB'], [0.85, 0.15]));
    } else if (line === 2) {
      drugs = s.priorIO && !ioLine1 ? [r.weighted(['NIVOLUMAB', 'PEMBROLIZUMAB', 'ATEZOLIZUMAB'], [0.45, 0.35, 0.2])] : [r.bool(0.6) ? 'GEMCITABINE' : 'VINORELBINE'];
    } else drugs = ['GEMCITABINE'];
    const ind = line === 1 ? 'Metastatic NSCLC - first line' : line === 2 ? 'Metastatic NSCLC - second line' : 'Metastatic NSCLC - third line';
    for (const dname of drugs) {
      const pStart = maybePartial(st, r, 0.18, 0.04);
      const pEnd = maybePartial(en, r, 0.15, 0.03);
      cms.push(cm(dname, r, { start: pStart, end: pEnd, ongoing: false, category: 'PRIOR CANCER THERAPY', indication: ind, dose: null, unit: null, freq: null }));
    }
    t = en + r.int(14, 35);
  }
  // ---- baseline medications for medical history ----
  for (const m of mhMeds) {
    const st = m.startDay + r.int(0, 120) < consent ? maybePartial(m.startDay + r.int(0, 120), r, 0.3, 0.1) : m.start;
    cms.push(cm(m.med, r, { start: st, ongoing: true, category: 'CONCOMITANT', indication: m.pt }));
  }
  // ---- on-study supportive care ----
  if (s.treated && s.firstDose !== null) {
    const lastDoc = s.exDoc.length ? s.exDoc[s.exDoc.length - 1].date : s.firstDose;
    const docOngoing = s.eotReason === null && !s.flags.docStoppedCumulative && lastDoc >= DCO - 25;
    const e1 = lastDoc + 1;
    cms.push(cm('DEXAMETHASONE', r, { start: full(s.firstDose - 1), end: docOngoing ? undefined : full(Math.min(e1, DCO)), ongoing: docOngoing, category: 'CONCOMITANT', indication: 'Premedication for docetaxel' }));
    if (r.bool(0.6))
      cms.push(cm('ONDANSETRON', r, { start: full(s.firstDose), end: docOngoing ? undefined : full(Math.min(lastDoc + 3, DCO)), ongoing: docOngoing, category: 'CONCOMITANT', indication: 'Prevention of chemotherapy-induced nausea' }));
    if (r.bool(0.2))
      cms.push(cm('PEGFILGRASTIM', r, { start: full(s.firstDose + 1), end: docOngoing ? undefined : full(Math.min(lastDoc + 1, DCO)), ongoing: docOngoing, freq: 'every 3 weeks', category: 'CONCOMITANT', indication: 'Primary prophylaxis of febrile neutropenia' }));
    // rescue medications linked to AEs
    for (const a of s.aes) {
      const meds = AE_MEDS[a.pt];
      if (!meds || a.phase === 'pre') continue;
      for (const m of meds) {
        if (!r.bool(m.p)) continue;
        const st = a.start + r.int(0, 1);
        if (st > DCO) continue;
        const aeEnd = a.start + a.dur - 1;
        const en = Math.min(aeEnd + r.int(0, 4), DCO);
        const ongoing = aeEnd > DCO - 3 || (s.deathDate !== null && aeEnd >= s.deathDate);
        cms.push(cm(m.med, r, { start: full(st), end: ongoing ? undefined : full(Math.max(st, en)), ongoing, category: 'CONCOMITANT', indication: a.verbatim }));
      }
    }
    if (r.bool(0.2)) {
      const st = toWeekday(s.firstDose + r.int(10, 200));
      if (st <= DCO && (s.deathDate === null || st < s.deathDate)) cms.push(cm(r.pick(['MORPHINE', 'OXYCODONE']), r, { start: full(st), ongoing: true, category: 'CONCOMITANT', indication: 'Cancer pain' }));
    }
  }
  // ---- new / subsequent anticancer therapy ----
  const sub = s.subTherapy;
  if (sub) {
    const names = sub.name === 'CARBOPLATIN + GEMCITABINE' ? ['CARBOPLATIN', 'GEMCITABINE'] : [sub.name];
    const en = sub.start + r.int(40, 200);
    const stillOn = en > DCO || (s.deathDate !== null && en >= s.deathDate);
    for (const n of names)
      cms.push(cm(n, r, { start: full(sub.start), end: stillOn ? undefined : full(en), ongoing: stillOn, category: 'SUBSEQUENT ANTICANCER THERAPY', indication: 'NSCLC', dose: null, unit: null, freq: null }));
  }
  if (s.flags.egfr && s.randDate !== null) {
    const st = s.randDate + r.int(8, 20);
    cms.push(cm('OSIMERTINIB', r, { start: full(st), ongoing: true, category: 'SUBSEQUENT ANTICANCER THERAPY', indication: 'EGFR-mutated NSCLC' }));
    s.subTherapy = { name: 'OSIMERTINIB', start: st };
  }
  // chronological order within category (prior first)
  const catOrder = { 'PRIOR CANCER THERAPY': 0, CONCOMITANT: 1, 'SUBSEQUENT ANTICANCER THERAPY': 2 };
  const key = (p: PartialDate) => p.y * 10000 + (p.m ?? 0) * 100 + (p.d ?? 0);
  cms.sort((a, b) => catOrder[a.category] - catOrder[b.category] || key(a.start) - key(b.start) || a.name.localeCompare(b.name));
  s.cms = cms;
}
