/**
 * ADaM layer (ADaMIG v1.3 conventions), derived exclusively from the SDTM
 * tables so that every value can be re-derived by a learner from SDTM.
 */
import { DCO, LAB, STUDYID, VS_TESTS } from './config.ts';
import { dayOf, iso, daysInMonth } from './dates.ts';
import type { Row, Table } from './csv.ts';

type T = Record<string, Row[]>;
const REGION: Record<string, string> = {
  USA: 'NORTH AMERICA', CAN: 'NORTH AMERICA', DEU: 'EUROPE', FRA: 'EUROPE', ESP: 'EUROPE', ITA: 'EUROPE', POL: 'EUROPE', GBR: 'EUROPE',
  JPN: 'ASIA-PACIFIC', KOR: 'ASIA-PACIFIC', TWN: 'ASIA-PACIFIC', AUS: 'ASIA-PACIFIC',
};
const RESP_N: Record<string, number> = { CR: 1, PR: 2, SD: 3, PD: 4, NE: 5 };

/** Complete ISO date (optionally with time) → day number; partial → null. */
const D = (v: unknown): number | null => (typeof v === 'string' && /^\d{4}-\d\d-\d\d/.test(v) ? dayOf(v.slice(0, 10)) : null);
const DT = (v: unknown): string => (typeof v === 'string' ? (v.length === 10 ? `${v}T00:00` : v) : '');
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const adyOf = (d: number | null, ref: number | null) => (d === null || ref === null ? null : d >= ref ? d - ref + 1 : d - ref);

function group(rows: Row[]): Map<string, Row[]> {
  const m = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.USUBJID as string;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return m;
}

export function buildAdam(tables: Table[]): Table[] {
  const S: T = Object.fromEntries(tables.map((t) => [t.name, t.rows]));
  const G = Object.fromEntries(Object.entries(S).map(([k, v]) => [k, group(v)])) as Record<string, Map<string, Row[]>>;
  const get = (dom: string, u: string) => G[dom].get(u) ?? [];
  const supp = (u: string, q: string) => (get('suppdm', u).find((x) => x.QNAM === q)?.QVAL as string | undefined) ?? null;

  /* =============================== ADSL =============================== */
  const adsl: Row[] = [];
  const lstSrc = new Map<string, { dom: string; v: string; seq: number | null }>();
  for (const dm of S.dm.filter((x) => x.ARMCD)) {
    const u = dm.USUBJID as string;
    const ex = get('ex', u);
    const ds = get('ds', u);
    const randdt = D(ds.find((x) => x.DSDECOD === 'RANDOMIZED')!.DSSTDTC);
    const trtsdtm = ex.length ? ex.map((x) => DT(x.EXSTDTC)).sort()[0] : null;
    const trtsdt = trtsdtm ? D(trtsdtm) : null;
    const trtedt = ex.length ? Math.max(...ex.map((x) => D(x.EXENDTC)!)) : null;
    const anyCbx = ex.some((x) => x.EXTRT === 'CBX-417');
    const trt01a = ex.length ? (anyCbx ? 'CBX-417 + Docetaxel' : 'Placebo + Docetaxel') : null;
    const refBl = trtsdt ?? randdt!;
    const vs = get('vs', u);
    const height = vs.find((x) => x.VSTESTCD === 'HEIGHT');
    const wts = vs.filter((x) => x.VSTESTCD === 'WEIGHT' && D(x.VSDTC)! <= refBl).sort((a, b) => (DT(a.VSDTC) < DT(b.VSDTC) ? -1 : 1));
    const w = wts.length ? Number(wts[wts.length - 1].VSSTRESN) : null;
    const h = height ? Number(height.VSSTRESN) : null;
    const ecogs = get('rs', u).filter((x) => x.RSTESTCD === 'ECOG101' && D(x.RSDTC)! <= refBl).sort((a, b) => (DT(a.RSDTC) < DT(b.RSDTC) ? -1 : 1));
    const eot = ds.find((x) => x.DSSCAT === 'STUDY TREATMENT');
    const eos = ds.find((x) => x.DSSCAT === 'STUDY PARTICIPATION');
    const dthdt = D(dm.DTHDTC);
    const tps = Number(supp(u, 'PDL1TPS'));
    // last known alive date
    let best = -Infinity;
    let bsrc: { dom: string; v: string; seq: number | null } = { dom: 'DS', v: 'DSSTDTC', seq: null };
    const consider = (dom: string, v: string, seqVar: string | null, rows: Row[], filt: (x: Row) => boolean = () => true) => {
      for (const x of rows) {
        if (!filt(x)) continue;
        const d = D(x[v]);
        if (d === null || d > DCO || (dthdt !== null && d > dthdt)) continue;
        if (d > best) {
          best = d;
          bsrc = { dom, v, seq: seqVar ? (x[seqVar] as number) : null };
        }
      }
    };
    consider('DS', 'DSSTDTC', 'DSSEQ', ds, (x) => x.DSDECOD !== 'DEATH' && x.DSDECOD !== 'LOST TO FOLLOW-UP');
    consider('EX', 'EXENDTC', 'EXSEQ', ex);
    consider('LB', 'LBDTC', 'LBSEQ', get('lb', u));
    consider('VS', 'VSDTC', 'VSSEQ', vs);
    consider('EG', 'EGDTC', 'EGSEQ', get('eg', u));
    consider('TR', 'TRDTC', 'TRSEQ', get('tr', u));
    consider('RS', 'RSDTC', 'RSSEQ', get('rs', u));
    consider('SS', 'SSDTC', 'SSSEQ', get('ss', u), (x) => x.SSSTRESC === 'ALIVE');
    lstSrc.set(u, bsrc);
    const tr = get('tr', u);
    const blScan = tr.find((x) => x.VISIT === 'SCREENING' && x.TRSTRESN !== null && D(x.TRDTC)! <= randdt!);
    const postResp = get('rs', u).filter((x) => x.RSTESTCD === 'OVRLRESP' && D(x.RSDTC)! > randdt!);
    const efffl = blScan && (postResp.length > 0 || (dthdt !== null && dthdt <= randdt! + 49)) ? 'Y' : 'N';
    const majorEff = get('dv', u).some((x) => x.DVSCAT === 'MAJOR' && ['ELIGIBILITY CRITERIA', 'INVESTIGATIONAL PRODUCT', 'EFFICACY ASSESSMENT', 'PROHIBITED THERAPY'].includes(x.DVCAT as string));
    const age = Number(dm.AGE);
    adsl.push({
      STUDYID, USUBJID: u, SUBJID: dm.SUBJID, SITEID: dm.SITEID, REGION1: REGION[dm.COUNTRY as string], COUNTRY: dm.COUNTRY, AGE: age, AGEU: dm.AGEU,
      AGEGR1: age >= 65 ? '>=65' : '<65', AGEGR1N: age >= 65 ? 2 : 1, SEX: dm.SEX, RACE: dm.RACE, ETHNIC: dm.ETHNIC,
      HEIGHTBL: h, WEIGHTBL: w, BMIBL: h && w ? r1(w / (h / 100) ** 2) : null, BSABL: h && w ? r2(Math.sqrt((h * w) / 3600)) : null,
      ECOGBL: ecogs.length ? Number(ecogs[ecogs.length - 1].RSSTRESN) : null,
      HISTOL: (supp(u, 'DISHIST') ?? '').includes('SQUAMOUS') ? 'SQUAMOUS' : 'NON-SQUAMOUS',
      PDL1CAT: tps < 1 ? '<1%' : tps < 50 ? '1-49%' : '>=50%', PRIORIO: supp(u, 'PRIORIO'), PRLINES: Number(supp(u, 'PRLINES')), BRAINMET: supp(u, 'BRAINMET'), SMOKSTAT: supp(u, 'SMOKSTAT'),
      STRAT1R: `ECOG ${supp(u, 'STRATECG')}`, STRAT2R: supp(u, 'STRATIO') === 'Y' ? 'PRIOR IO YES' : 'PRIOR IO NO',
      ARM: dm.ARM, ARMCD: dm.ARMCD, ACTARM: dm.ACTARM, ACTARMCD: dm.ACTARMCD,
      TRT01P: dm.ARMCD === 'CBX+DOC' ? 'CBX-417 + Docetaxel' : 'Placebo + Docetaxel', TRT01PN: dm.ARMCD === 'CBX+DOC' ? 1 : 2,
      TRT01A: trt01a, TRT01AN: trt01a ? (anyCbx ? 1 : 2) : null,
      RANDDT: iso(randdt!), TRTSDT: trtsdt !== null ? iso(trtsdt) : null, TRTSDTM: trtsdtm, TRTEDT: trtedt !== null ? iso(trtedt) : null,
      TRTDURD: trtsdt !== null && trtedt !== null ? trtedt - trtsdt + 1 : null,
      EOTSTT: eot ? 'DISCONTINUED' : trtsdt !== null ? 'ONGOING' : null, DCTREAS: eot ? eot.DSDECOD : null, DCTDT: eot ? eot.DSSTDTC : null,
      EOSSTT: eos ? 'DISCONTINUED' : 'ONGOING', DCSREAS: eos ? eos.DSDECOD : null, EOSDT: eos ? eos.DSSTDTC : null,
      DTHFL: dthdt !== null ? 'Y' : 'N', DTHDT: dthdt !== null ? iso(dthdt) : null, DTHCAUS: (get('dd', u)[0]?.DDSTRESC as string) ?? null,
      LSTALVDT: iso(best), RANDFL: 'Y', ITTFL: 'Y', SAFFL: trtsdt !== null ? 'Y' : 'N', EFFFL: efffl,
      PPROTFL: trtsdt !== null && !majorEff ? 'Y' : 'N', DCUTDT: iso(DCO),
    });
  }
  const ADSL = new Map(adsl.map((x) => [x.USUBJID as string, x]));

  /* =============================== ADAE =============================== */
  const adae: Row[] = [];
  const suppae = group(S.suppae);
  for (const a of S.ae) {
    const sl = ADSL.get(a.USUBJID as string);
    if (!sl) continue;
    const trtsdt = D(sl.TRTSDT);
    const trtedt = D(sl.TRTEDT);
    const st = a.AESTDTC as string;
    const en = (a.AEENDTC as string | null) ?? null;
    const dth = D(sl.DTHDT);
    // end date imputation: last day of month / Dec 31, not after death or data cutoff
    let aendt: number | null = null;
    let aendtf: string | null = null;
    if (en) {
      if (en.length === 10) aendt = D(en);
      else {
        const y = Number(en.slice(0, 4));
        if (en.length === 7) {
          const m = Number(en.slice(5, 7));
          aendt = dayOf(`${en}-${String(daysInMonth(y, m)).padStart(2, '0')}`);
          aendtf = 'D';
        } else {
          aendt = dayOf(`${y}-12-31`);
          aendtf = 'M';
        }
        aendt = Math.min(aendt, dth ?? Infinity, DCO);
      }
    }
    // start date imputation per SAP
    let astdt: number;
    let astdtf: string | null = null;
    if (st.length === 10) astdt = D(st)!;
    else {
      const y = Number(st.slice(0, 4));
      const first = st.length === 7 ? dayOf(`${st}-01`) : dayOf(`${y}-01-01`);
      const sameMonth = trtsdt !== null && st.length === 7 && iso(trtsdt).slice(0, 7) === st;
      const sameYear = trtsdt !== null && st.length === 4 && iso(trtsdt).slice(0, 4) === st;
      astdt = sameMonth || sameYear ? trtsdt! : first;
      if (aendt !== null && astdt > aendt) astdt = Math.max(first, aendt);
      astdtf = st.length === 7 ? 'D' : 'M';
    }
    const trtem = trtsdt !== null && astdt >= trtsdt && astdt <= trtedt! + 30 ? 'Y' : null;
    const sp = (suppae.get(a.USUBJID as string) ?? []).filter((x) => x.IDVARVAL === String(a.AESEQ));
    adae.push({
      STUDYID, USUBJID: a.USUBJID, SUBJID: sl.SUBJID, SITEID: sl.SITEID, AGE: sl.AGE, AGEGR1: sl.AGEGR1, SEX: sl.SEX, RACE: sl.RACE, SAFFL: sl.SAFFL,
      TRT01A: sl.TRT01A, TRT01AN: sl.TRT01AN, TRTA: sl.TRT01A, TRTAN: sl.TRT01AN, TRTSDT: sl.TRTSDT, TRTEDT: sl.TRTEDT,
      AESEQ: a.AESEQ, AESPID: a.AESPID, AETERM: a.AETERM, AEDECOD: a.AEDECOD, AEBODSYS: a.AEBODSYS, AESOC: a.AESOC, AESTDTC: a.AESTDTC, AEENDTC: a.AEENDTC,
      ASTDT: iso(astdt), ASTDTF: astdtf, AENDT: aendt !== null ? iso(aendt) : null, AENDTF: aendtf,
      ASTDY: adyOf(astdt, trtsdt), AENDY: adyOf(aendt, trtsdt), ADURN: aendt !== null ? aendt - astdt + 1 : null, ADURU: aendt !== null ? 'DAYS' : null,
      AETOXGR: a.AETOXGR, ATOXGR: a.AETOXGR, ATOXGRN: Number(a.AETOXGR), AESER: a.AESER, AESDTH: a.AESDTH, AEOUT: a.AEOUT,
      AEREL: a.AEREL, AREL: a.AEREL ?? 'RELATED', AERELDOC: sp.find((x) => x.QNAM === 'AERELDOC')?.QVAL ?? null,
      AEACN: a.AEACN, AEACNDOC: sp.find((x) => x.QNAM === 'AEACNDOC')?.QVAL ?? null, TRTEMFL: trtem, AOCCFL: null, AOCCSFL: null, AOCCPFL: null,
    });
  }
  const aeBySubj = group(adae);
  for (const rows of aeBySubj.values()) {
    const te = rows.filter((x) => x.TRTEMFL === 'Y').sort((a, b) => (a.ASTDT! < b.ASTDT! ? -1 : a.ASTDT! > b.ASTDT! ? 1 : Number(a.AESEQ) - Number(b.AESEQ)));
    const seenS = new Set<string>();
    const seenP = new Set<string>();
    te.forEach((x, i) => {
      if (i === 0) x.AOCCFL = 'Y';
      if (!seenS.has(x.AEBODSYS as string)) {
        seenS.add(x.AEBODSYS as string);
        x.AOCCSFL = 'Y';
      }
      if (!seenP.has(x.AEDECOD as string)) {
        seenP.add(x.AEDECOD as string);
        x.AOCCPFL = 'Y';
      }
    });
  }
  adae.sort((a, b) => (a.USUBJID === b.USUBJID ? Number(a.AESEQ) - Number(b.AESEQ) : String(a.USUBJID) < String(b.USUBJID) ? -1 : 1));

  /* =============================== BDS helpers =============================== */
  const windowVisit = (ady: number): { v: string; n: number } | null => {
    if (ady >= 2 && ady <= 11) return { v: 'CYCLE 1 DAY 8', n: 11 };
    if (ady < 12) return null;
    const n = Math.max(2, Math.round((ady - 1) / 21) + 1);
    return { v: `CYCLE ${n} DAY 1`, n: n * 10 };
  };
  const labGrade = (code: string, v: number, lo: number, hi: number): number | null => {
    switch (code) {
      case 'ALT':
      case 'AST':
        return v > 20 * hi ? 4 : v > 5 * hi ? 3 : v > 3 * hi ? 2 : v > hi ? 1 : 0;
      case 'BILI':
        return v > 10 * hi ? 4 : v > 3 * hi ? 3 : v > 1.5 * hi ? 2 : v > hi ? 1 : 0;
      case 'NEUT':
        return v < 0.5 ? 4 : v < 1.0 ? 3 : v < 1.5 ? 2 : v < lo ? 1 : 0;
      case 'PLAT':
        return v < 25 ? 4 : v < 50 ? 3 : v < 75 ? 2 : v < lo ? 1 : 0;
      case 'HGB':
        return v < 80 ? 3 : v < 100 ? 2 : v < lo ? 1 : 0;
      default:
        return null;
    }
  };

  interface BdsIn {
    u: string;
    paramcd: string;
    aval: number;
    dtc: string;
    visit: string;
    visitnum: number;
    seq: number;
    lobx: boolean;
    extra?: Row;
  }
  /** Generic BDS builder: baseline, change, windows, analysis flags. */
  const bds = (items: BdsIn[], opt: { srcdom: string; srcvar: string; useLobx?: boolean; params: Record<string, { param: string; parcat?: string }> }): Row[] => {
    const out: Row[] = [];
    const bySp = new Map<string, BdsIn[]>();
    for (const it of items) {
      const k = `${it.u}|${it.paramcd}`;
      if (!bySp.has(k)) bySp.set(k, []);
      bySp.get(k)!.push(it);
    }
    for (const [k, list] of bySp) {
      const u = k.split('|')[0];
      const sl = ADSL.get(u);
      if (!sl) continue;
      list.sort((a, b) => (DT(a.dtc) < DT(b.dtc) ? -1 : DT(a.dtc) > DT(b.dtc) ? 1 : a.seq - b.seq));
      const trtsdt = D(sl.TRTSDT);
      const trtsdtm = sl.TRTSDTM as string | null;
      const trtedt = D(sl.TRTEDT);
      const refDay = trtsdt ?? D(sl.RANDDT)!;
      const isPre = (it: BdsIn) => (opt.useLobx && trtsdtm ? DT(it.dtc) < trtsdtm : D(it.dtc)! <= refDay);
      let bl: BdsIn | null = null;
      if (opt.useLobx && trtsdtm) bl = list.filter((x) => x.lobx).pop() ?? null;
      else bl = list.filter(isPre).pop() ?? null;
      const rows = list.map((it) => {
        const adt = D(it.dtc)!;
        const ady = adyOf(adt, trtsdt);
        const pre = isPre(it);
        const isBl = it === bl;
        let avisit: string | null;
        let avisitn: number | null;
        if (isBl) {
          avisit = 'BASELINE';
          avisitn = 0;
        } else if (pre) {
          avisit = it.visit;
          avisitn = it.visit === 'SCREENING' ? -1 : it.visitnum;
        } else if (it.visit !== 'UNSCHEDULED') {
          avisit = it.visit;
          avisitn = it.visitnum;
        } else {
          const wv = ady !== null && trtedt !== null && adt <= trtedt + 7 ? windowVisit(ady) : null;
          avisit = wv?.v ?? null;
          avisitn = wv?.n ?? null;
        }
        const post = !pre && trtsdt !== null;
        const base = bl ? bl.aval : null;
        const chg = post && base !== null ? r4(it.aval - base) : null;
        const pchg = post && base !== null && base !== 0 ? r2((100 * (it.aval - base)) / base) : null;
        const ontrt = trtsdt !== null && (opt.useLobx && trtsdtm ? DT(it.dtc) > trtsdtm : adt > trtsdt) && adt <= trtedt! + 30 ? 'Y' : null;
        return {
          it, row: {
            STUDYID, USUBJID: u, SAFFL: sl.SAFFL, TRTA: sl.TRT01A, TRTAN: sl.TRT01AN, PARAMCD: it.paramcd, PARAM: opt.params[it.paramcd].param,
            ...(opt.params[it.paramcd].parcat ? { PARCAT1: opt.params[it.paramcd].parcat } : {}),
            AVAL: it.aval, ADT: iso(adt), ...(opt.useLobx ? { ADTM: it.dtc } : {}), ADY: ady, AVISIT: avisit, AVISITN: avisitn, ABLFL: isBl ? 'Y' : null,
            BASE: base, CHG: chg, PCHG: pchg, ...(it.extra ?? {}), ONTRTFL: ontrt, ANL01FL: null as string | null,
            SRCDOM: opt.srcdom, SRCVAR: opt.srcvar, SRCSEQ: it.seq,
          } as Row,
        };
      });
      // one analysis record per AVISIT: the scheduled record, else the latest unscheduled
      const byVis = new Map<string, typeof rows>();
      for (const x of rows) {
        if (x.row.AVISIT === null || (x.row.ABLFL !== 'Y' && isPre(x.it))) continue;
        const kk = x.row.AVISIT as string;
        if (!byVis.has(kk)) byVis.set(kk, []);
        byVis.get(kk)!.push(x);
      }
      for (const vl of byVis.values()) {
        const sched = vl.filter((x) => x.it.visit !== 'UNSCHEDULED');
        const pick = sched.length ? sched[sched.length - 1] : vl[vl.length - 1];
        pick.row.ANL01FL = 'Y';
      }
      for (const x of rows) out.push(x.row);
    }
    return out;
  };

  /* =============================== ADLB =============================== */
  const lbItems: BdsIn[] = [];
  const lbExtra = new Map<Row, Row>();
  for (const l of S.lb) {
    if (l.LBSTAT === 'NOT DONE' || !ADSL.has(l.USUBJID as string)) continue;
    const it: BdsIn = { u: l.USUBJID as string, paramcd: l.LBTESTCD as string, aval: Number(l.LBSTRESN), dtc: l.LBDTC as string, visit: l.VISIT as string, visitnum: Number(l.VISITNUM), seq: Number(l.LBSEQ), lobx: l.LBLOBXFL === 'Y' };
    it.extra = { ANRLO: num(l.LBSTNRLO), ANRHI: num(l.LBSTNRHI) } as Row;
    lbItems.push(it);
    lbExtra.set(it.extra, l);
  }
  const lbParams = Object.fromEntries(Object.values(LAB).map((t) => [t.code, { param: t.param, parcat: t.cat }]));
  const adlb = bds(lbItems, { srcdom: 'LB', srcvar: 'LBSTRESN', params: lbParams });
  // reference-range and toxicity-grade variables
  const blInd = new Map<string, { ind: string; g: number | null }>();
  for (const x of adlb) {
    const v = Number(x.AVAL);
    const lo = Number(x.ANRLO);
    const hi = Number(x.ANRHI);
    x.ANRIND = v < lo ? 'LOW' : v > hi ? 'HIGH' : 'NORMAL';
    const g = labGrade(x.PARAMCD as string, v, lo, hi);
    x.ATOXGR = g === null ? null : String(g);
    x.ATOXGRN = g;
    if (x.ABLFL === 'Y') blInd.set(`${x.USUBJID}|${x.PARAMCD}`, { ind: x.ANRIND as string, g });
  }
  const adlbOut = adlb.map((x) => {
    const b = blInd.get(`${x.USUBJID}|${x.PARAMCD}`);
    const o: Row = {};
    for (const c of ['STUDYID', 'USUBJID', 'SAFFL', 'TRTA', 'TRTAN', 'PARAMCD', 'PARAM', 'PARCAT1', 'AVAL', 'ADT', 'ADY', 'AVISIT', 'AVISITN', 'ABLFL', 'BASE', 'CHG', 'PCHG', 'ANRLO', 'ANRHI', 'ANRIND']) o[c] = x[c];
    o.BNRIND = b?.ind ?? null;
    o.ATOXGR = x.ATOXGR;
    o.ATOXGRN = x.ATOXGRN;
    o.BTOXGR = b && b.g !== null ? String(b.g) : null;
    o.BTOXGRN = b ? b.g : null;
    for (const c of ['ONTRTFL', 'ANL01FL', 'SRCDOM', 'SRCVAR', 'SRCSEQ']) o[c] = x[c];
    return o;
  });

  /* =============================== ADVS =============================== */
  const vsItems: BdsIn[] = S.vs
    .filter((v) => v.VSTESTCD !== 'HEIGHT' && ADSL.has(v.USUBJID as string))
    .map((v) => ({ u: v.USUBJID as string, paramcd: v.VSTESTCD as string, aval: Number(v.VSSTRESN), dtc: v.VSDTC as string, visit: v.VISIT as string, visitnum: Number(v.VISITNUM), seq: Number(v.VSSEQ), lobx: v.VSLOBXFL === 'Y' }));
  const advs = bds(vsItems, { srcdom: 'VS', srcvar: 'VSSTRESN', params: Object.fromEntries(VS_TESTS.map((t) => [t.code, { param: t.param }])) });

  /* =============================== ADEG =============================== */
  const egItems: BdsIn[] = S.eg
    .filter((e) => e.EGTESTCD !== 'INTP' && ADSL.has(e.USUBJID as string))
    .map((e) => ({ u: e.USUBJID as string, paramcd: e.EGTESTCD as string, aval: Number(e.EGSTRESN), dtc: e.EGDTC as string, visit: e.VISIT as string, visitnum: Number(e.VISITNUM), seq: Number(e.EGSEQ), lobx: e.EGLOBXFL === 'Y' }));
  const adeg = bds(egItems, { srcdom: 'EG', srcvar: 'EGSTRESN', useLobx: true, params: { QTCFAG: { param: 'QTcF Interval, Aggregate (ms)' }, EGHRMN: { param: 'ECG Mean Heart Rate (beats/min)' } } });
  const adegOut = adeg.map((x) => {
    const q = x.PARAMCD === 'QTCFAG';
    const v = Number(x.AVAL);
    const c = x.CHG === null ? null : Number(x.CHG);
    const m1 = q ? (v <= 450 ? ['<=450', 1] : v <= 480 ? ['>450 to <=480', 2] : v <= 500 ? ['>480 to <=500', 3] : ['>500', 4]) : null;
    const m2 = q && c !== null ? (c <= 30 ? ['<=30', 1] : c <= 60 ? ['>30 to <=60', 2] : ['>60', 3]) : null;
    const o: Row = {};
    for (const k of ['STUDYID', 'USUBJID', 'SAFFL', 'TRTA', 'TRTAN', 'PARAMCD', 'PARAM', 'AVAL', 'ADT', 'ADTM', 'ADY', 'AVISIT', 'AVISITN', 'ABLFL', 'BASE', 'CHG', 'PCHG', 'ONTRTFL', 'ANL01FL']) o[k] = x[k];
    o.MCRIT1 = q ? 'QTcF interval category (ms)' : null;
    o.MCRIT1ML = m1 ? (m1[0] as string) : null;
    o.MCRIT1MN = m1 ? (m1[1] as number) : null;
    o.MCRIT2 = m2 ? 'QTcF change from baseline category (ms)' : null;
    o.MCRIT2ML = m2 ? (m2[0] as string) : null;
    o.MCRIT2MN = m2 ? (m2[1] as number) : null;
    for (const k of ['SRCDOM', 'SRCVAR', 'SRCSEQ']) o[k] = x[k];
    return o;
  });

  /* =============================== ADRS / ADTR / ADTTE =============================== */
  const adrs: Row[] = [];
  const adtr: Row[] = [];
  const adtte: Row[] = [];
  const weeks: number[] = [0];
  for (let w = 6; w <= 48; w += 6) weeks.push(w);
  for (let w = 57; w <= 57 + 9 * 40; w += 9) weeks.push(w);
  const covars = (sl: Row) => ({
    TRTP: sl.TRT01P, TRTPN: sl.TRT01PN, ITTFL: sl.ITTFL, EFFFL: sl.EFFFL, STRAT1R: sl.STRAT1R, STRAT2R: sl.STRAT2R, AGEGR1: sl.AGEGR1, SEX: sl.SEX, REGION1: sl.REGION1,
    ECOGBL: sl.ECOGBL, HISTOL: sl.HISTOL, PDL1CAT: sl.PDL1CAT, BRAINMET: sl.BRAINMET, PRIORIO: sl.PRIORIO,
  });
  for (const sl of adsl) {
    const u = sl.USUBJID as string;
    const randdt = D(sl.RANDDT)!;
    const trtsdt = D(sl.TRTSDT);
    const rs = get('rs', u).filter((x) => x.RSTESTCD === 'OVRLRESP' && D(x.RSDTC)! > randdt).sort((a, b) => (a.RSDTC! < b.RSDTC! ? -1 : a.RSDTC! > b.RSDTC! ? 1 : Number(a.RSSEQ) - Number(b.RSSEQ)));
    const cmNact = get('cm', u).filter((x) => x.CMCAT === 'SUBSEQUENT ANTICANCER THERAPY' && D(x.CMSTDTC) !== null).map((x) => D(x.CMSTDTC)!);
    const nact = cmNact.length ? Math.min(...cmNact) : null;
    const firstPd = rs.find((x) => x.RSSTRESC === 'PD');
    const pdDay = firstPd ? D(firstPd.RSDTC)! : null;
    const cut = Math.min(pdDay ?? Infinity, nact !== null ? nact : Infinity);
    const anl = (x: Row) => {
      const d = D(x.RSDTC)!;
      return d <= (pdDay ?? Infinity) && (nact === null || d <= nact) ? 'Y' : null;
    };
    const cov = covars(sl);
    const base = { STUDYID, USUBJID: u, ITTFL: sl.ITTFL, EFFFL: sl.EFFFL, TRTP: sl.TRT01P, TRTPN: sl.TRT01PN, STRAT1R: sl.STRAT1R, STRAT2R: sl.STRAT2R };
    for (const x of rs) {
      const d = D(x.RSDTC)!;
      adrs.push({ ...base, PARAMCD: 'OVRLRESP', PARAM: 'Overall Response by Investigator', PARCAT1: 'RECIST 1.1', AVALC: x.RSSTRESC, AVAL: RESP_N[x.RSSTRESC as string], ADT: iso(d), ADY: adyOf(d, trtsdt), AVISIT: x.VISIT, AVISITN: x.VISITNUM, ANL01FL: anl(x), SRCDOM: 'RS', SRCVAR: 'RSSTRESC', SRCSEQ: x.RSSEQ });
    }
    const ev = rs.filter((x) => anl(x) === 'Y');
    const sdOk = (x: Row) => D(x.RSDTC)! >= randdt + 35;
    // best overall response (unconfirmed)
    const firstOf = (c: (x: Row) => boolean) => ev.find(c) ?? null;
    let bor = firstOf((x) => x.RSSTRESC === 'CR');
    let borC = 'CR';
    if (!bor) (bor = firstOf((x) => x.RSSTRESC === 'PR')), (borC = 'PR');
    if (!bor) (bor = firstOf((x) => ['SD', 'PR', 'CR'].includes(x.RSSTRESC as string) && sdOk(x))), (borC = 'SD');
    if (!bor) (bor = firstOf((x) => x.RSSTRESC === 'PD')), (borC = 'PD');
    if (!bor) borC = 'NE';
    // confirmed best overall response (SAP: repeat CR/PR >= 28 days later, no intervening PD)
    let conf: Row | null = null;
    let confC = '';
    for (let i = 0; i < ev.length && !conf; i++)
      if (ev[i].RSSTRESC === 'CR' && ev.slice(i + 1).some((y) => y.RSSTRESC === 'CR' && D(y.RSDTC)! - D(ev[i].RSDTC)! >= 28)) (conf = ev[i]), (confC = 'CR');
    for (let i = 0; i < ev.length && !conf; i++)
      if (['CR', 'PR'].includes(ev[i].RSSTRESC as string) && ev.slice(i + 1).some((y) => ['CR', 'PR'].includes(y.RSSTRESC as string) && D(y.RSDTC)! - D(ev[i].RSDTC)! >= 28)) (conf = ev[i]), (confC = 'PR');
    if (!conf) {
      conf = firstOf((x) => ['SD', 'PR', 'CR'].includes(x.RSSTRESC as string) && sdOk(x));
      confC = 'SD';
      if (!conf) (conf = firstOf((x) => x.RSSTRESC === 'PD')), (confC = 'PD');
      if (!conf) confC = 'NE';
    }
    for (const [cd, name, rec, c] of [
      ['BOR', 'Best Overall Response by Investigator (unconfirmed)', bor, borC],
      ['CBOR', 'Confirmed Best Overall Response by Investigator', conf, confC],
    ] as [string, string, Row | null, string][]) {
      const d = rec ? D(rec.RSDTC)! : null;
      adrs.push({ ...base, PARAMCD: cd, PARAM: name, PARCAT1: 'RECIST 1.1', AVALC: c, AVAL: RESP_N[c], ADT: d !== null ? iso(d) : null, ADY: adyOf(d, trtsdt), AVISIT: null, AVISITN: null, ANL01FL: 'Y', SRCDOM: rec ? 'RS' : null, SRCVAR: rec ? 'RSSTRESC' : null, SRCSEQ: rec ? rec.RSSEQ : null });
    }

    // ---------- ADTR ----------
    const trs = get('tr', u).filter((x) => x.TRSTRESN !== null).sort((a, b) => (a.TRDTC! < b.TRDTC! ? -1 : 1));
    const bl = trs.filter((x) => D(x.TRDTC)! <= randdt).pop() ?? null;
    let bestP: { v: number; x: Row } | null = null;
    for (const x of trs) {
      const d = D(x.TRDTC)!;
      const isBl = x === bl;
      const post = d > randdt && bl !== null;
      const b = bl ? Number(bl.TRSTRESN) : null;
      const chg = post && b !== null ? Number(x.TRSTRESN) - b : null;
      const pchg = post && b ? r2((100 * (Number(x.TRSTRESN) - b)) / b) : null;
      const a = isBl || (post && d <= (pdDay ?? Infinity) && (nact === null || d <= nact)) ? 'Y' : null;
      adtr.push({ ...base, PARAMCD: 'SUMDIAM', PARAM: 'Sum of Diameters of Target Lesions (mm)', AVAL: Number(x.TRSTRESN), ADT: iso(d), ADY: adyOf(d, trtsdt), AVISIT: isBl ? 'BASELINE' : x.VISIT, AVISITN: isBl ? 0 : x.VISITNUM, ABLFL: isBl ? 'Y' : null, BASE: b, CHG: chg, PCHG: pchg, ANL01FL: a, SRCDOM: 'TR', SRCVAR: 'TRSTRESN', SRCSEQ: x.TRSEQ });
      if (post && a === 'Y' && pchg !== null && (!bestP || pchg < bestP.v)) bestP = { v: pchg, x };
    }
    if (bestP) {
      const d = D(bestP.x.TRDTC)!;
      adtr.push({ ...base, PARAMCD: 'BPCHG', PARAM: 'Best Percent Change from Baseline in Sum of Diameters (%)', AVAL: bestP.v, ADT: iso(d), ADY: adyOf(d, trtsdt), AVISIT: null, AVISITN: null, ABLFL: null, BASE: bl ? Number(bl.TRSTRESN) : null, CHG: null, PCHG: null, ANL01FL: 'Y', SRCDOM: 'TR', SRCVAR: 'TRSTRESN', SRCSEQ: bestP.x.TRSEQ });
    }

    // ---------- ADTTE: PFS ----------
    const ds = get('ds', u);
    const dsRand = ds.find((x) => x.DSDECOD === 'RANDOMIZED')!;
    const dsDeath = ds.find((x) => x.DSDECOD === 'DEATH' && x.DSSCAT === 'STUDY PARTICIPATION') ?? ds.find((x) => x.DSDECOD === 'DEATH');
    const dth = D(sl.DTHDT);
    const adequate = rs.filter((x) => ['CR', 'PR', 'SD', 'PD'].includes(x.RSSTRESC as string));
    const hasBl = bl !== null;
    const lastAdeqBefore = (lim: number, inclusive: boolean) => adequate.filter((x) => (inclusive ? D(x.RSDTC)! <= lim : D(x.RSDTC)! < lim)).pop() ?? null;
    let pfs: { adt: number; cnsr: number; ev: string; cdesc: string | null; src: [string, string, unknown] };
    const rand = (ev: string, cnsr: number, cdesc: string) => ({ adt: randdt, cnsr, ev, cdesc, src: ['DS', 'DSSTDTC', dsRand.DSSEQ] as [string, string, unknown] });
    const fromRs = (x: Row, cnsr: number, ev: string, cdesc: string | null) => ({ adt: D(x.RSDTC)!, cnsr, ev, cdesc, src: ['RS', 'RSDTC', x.RSSEQ] as [string, string, unknown] });
    const death = () => ({ adt: dth!, cnsr: 0, ev: 'DEATH', cdesc: null, src: ['DS', 'DSSTDTC', dsDeath?.DSSEQ ?? null] as [string, string, unknown] });
    if (!hasBl || adequate.length === 0) {
      if (dth !== null && dth <= randdt + 91) pfs = death();
      else pfs = rand('NO BASELINE OR NO ADEQUATE POST-BASELINE ASSESSMENT', 2, 'RANDOMIZATION DATE');
    } else {
      const evDay = Math.min(pdDay ?? Infinity, dth ?? Infinity);
      if (nact !== null && nact < evDay) {
        const L = lastAdeqBefore(nact, true);
        pfs = L ? fromRs(L, 3, 'NEW ANTICANCER THERAPY BEFORE PD OR DEATH', 'LAST ADEQUATE ASSESSMENT ON OR BEFORE NEW ANTICANCER THERAPY') : rand('NEW ANTICANCER THERAPY BEFORE PD OR DEATH', 3, 'RANDOMIZATION DATE (NO ADEQUATE ASSESSMENT BEFORE NEW ANTICANCER THERAPY)');
      } else if (evDay !== Infinity) {
        const L = lastAdeqBefore(evDay, false);
        const lDay = L ? D(L.RSDTC)! : randdt;
        let wk = 0;
        for (const w of weeks) if (randdt + 7 * w - 7 <= lDay) wk = w;
        const i = weeks.indexOf(wk);
        const thr = randdt + 7 * weeks[i + 2] + 7;
        if (evDay > thr) pfs = L ? fromRs(L, 4, 'PD OR DEATH AFTER >=2 MISSED ASSESSMENTS', 'LAST ADEQUATE ASSESSMENT BEFORE MISSED ASSESSMENTS') : rand('PD OR DEATH AFTER >=2 MISSED ASSESSMENTS', 4, 'RANDOMIZATION DATE');
        else if (pdDay !== null && pdDay <= (dth ?? Infinity)) pfs = fromRs(firstPd!, 0, 'DISEASE PROGRESSION', null);
        else pfs = death();
      } else {
        const L = adequate[adequate.length - 1];
        pfs = fromRs(L, 1, 'NO PD OR DEATH (ALIVE WITHOUT DOCUMENTED PROGRESSION)', 'LAST ADEQUATE TUMOR ASSESSMENT');
      }
    }
    const tte = (paramcd: string, param: string, paramn: number, start: number, x: typeof pfs) => ({
      STUDYID, USUBJID: u, SUBJID: sl.SUBJID, PARAMCD: paramcd, PARAM: param, PARAMN: paramn, STARTDT: iso(start), ADT: iso(x.adt), AVAL: x.adt - start + 1, AVALU: 'DAYS',
      CNSR: x.cnsr, EVNTDESC: x.ev, CNSDTDSC: x.cdesc, SRCDOM: x.src[0], SRCVAR: x.src[1], SRCSEQ: x.src[2] as number | null, ...cov,
    });
    adtte.push(tte('PFS', 'Progression-free Survival (days)', 1, randdt, pfs));
    // ---------- OS ----------
    let os: typeof pfs;
    if (dth !== null) os = death();
    else {
      const s = lstSrc.get(u)!;
      os = { adt: D(sl.LSTALVDT)!, cnsr: 1, ev: 'ALIVE AT LAST CONTACT', cdesc: 'LAST KNOWN ALIVE DATE', src: [s.dom, s.v, s.seq] };
    }
    adtte.push(tte('OS', 'Overall Survival (days)', 2, randdt, os));
    // ---------- DOR (confirmed responders) ----------
    if (confC === 'CR' || confC === 'PR') {
      const st = D(conf!.RSDTC)!;
      adtte.push(tte('DOR', 'Duration of Response (days)', 3, st, pfs.adt >= st ? pfs : { ...pfs, adt: st }));
    }
    void cut;
  }
  const sortBy = (rows: Row[], keys: string[]) =>
    rows.sort((a, b) => {
      for (const k of keys) {
        const x = a[k];
        const y = b[k];
        if (x === y) continue;
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        if (typeof x === 'number' && typeof y === 'number') return x - y;
        return String(x) < String(y) ? -1 : 1;
      }
      return 0;
    });
  sortBy(adlbOut, ['USUBJID', 'PARAMCD', 'ADT', 'SRCSEQ']);
  sortBy(advs, ['USUBJID', 'PARAMCD', 'ADT', 'SRCSEQ']);
  sortBy(adegOut, ['USUBJID', 'PARAMCD', 'ADTM', 'SRCSEQ']);
  const pOrd: Record<string, number> = { OVRLRESP: 1, BOR: 2, CBOR: 3, SUMDIAM: 1, BPCHG: 2 };
  adrs.sort((a, b) => (a.USUBJID !== b.USUBJID ? (String(a.USUBJID) < String(b.USUBJID) ? -1 : 1) : pOrd[a.PARAMCD as string] - pOrd[b.PARAMCD as string] || String(a.ADT ?? '').localeCompare(String(b.ADT ?? ''))));
  adtr.sort((a, b) => (a.USUBJID !== b.USUBJID ? (String(a.USUBJID) < String(b.USUBJID) ? -1 : 1) : pOrd[a.PARAMCD as string] - pOrd[b.PARAMCD as string] || String(a.ADT ?? '').localeCompare(String(b.ADT ?? ''))));
  adtte.sort((a, b) => (a.USUBJID !== b.USUBJID ? (String(a.USUBJID) < String(b.USUBJID) ? -1 : 1) : Number(a.PARAMN) - Number(b.PARAMN)));
  const advsOut = advs.map((x) => {
    const o: Row = {};
    for (const k of ['STUDYID', 'USUBJID', 'SAFFL', 'TRTA', 'TRTAN', 'PARAMCD', 'PARAM', 'AVAL', 'ADT', 'ADY', 'AVISIT', 'AVISITN', 'ABLFL', 'BASE', 'CHG', 'PCHG', 'ONTRTFL', 'ANL01FL', 'SRCDOM', 'SRCVAR', 'SRCSEQ']) o[k] = x[k];
    return o;
  });
  const T2 = (name: string, rows: Row[]): Table => ({ name, columns: Object.keys(rows[0]), rows });
  return [T2('adsl', adsl), T2('adae', adae), T2('adlb', adlbOut), T2('advs', advsOut), T2('adeg', adegOut), T2('adrs', adrs), T2('adtr', adtr), T2('adtte', adtte)];
}
