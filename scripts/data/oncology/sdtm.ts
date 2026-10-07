/**
 * SDTM layer (SDTMIG v3.4-style) built from the corrected truth, plus the
 * lineage table that maps every SDTM record to the raw row(s) it came from.
 */
import {
  ARMS, CM_CATALOG, C1D8, DCO, ECOG_TEXT, FREQ_MAP, LAB, ROUTE_MAP, SOC, STUDYID, UNIT_MAP, VISIT, VS_TESTS, cycleVisit, survVisit,
} from './config.ts';
import { iso, isoDT, isoPartial, studyDay, dayOfPartial, type PartialDate } from './dates.ts';
import type { Row, Table } from './csv.ts';
import type { Truth } from './truth.ts';
import type { RawResult, RawRow } from './raw.ts';
import type { TSubject } from './types.ts';

export interface SdtmResult {
  tables: Table[];
  lineage: Table;
}

type Src = { file: string; row: RawRow | null; note?: string };

const RAW_FILE_OF = (row: RawRow) => {
  const p = row.RECORD_ID.split('-')[0];
  return ({ ENR: 'enrollment.csv', DEM: 'demographics.csv', BD: 'baseline_disease.csv', RND: 'randomization.csv', KIT: 'kit_list.csv', EXS: 'ex_study_drug.csv', EXD: 'ex_docetaxel.csv', AE: 'ae.csv', CM: 'cm.csv', MH: 'mh.csv', LB: 'labs.csv', VS: 'vitals.csv', ECG: 'ecg.csv', TUM: 'tumor_assessment.csv', EOT: 'eot.csv', EOS: 'eos.csv', DTH: 'death.csv', SFU: 'survival_followup.csv', CTMS: 'deviations.csv' } as Record<string, string>)[p];
};

export function buildSdtm(T: Truth, R: RawResult): SdtmResult {
  const lineage: Row[] = [];
  const subjects = [...T.subjects].sort((a, b) => a.usubjid.localeCompare(b.usubjid));
  const rnd = subjects.filter((s) => !s.screenFail);

  const note = (row: RawRow | null) => (row ? (R.rowIssues.get(row) ?? []).map((i) => `corrected per ${i}`).join('; ') : '');
  const link = (domain: string, usubjid: string, seq: number | string, srcs: Src[]) => {
    for (const x of srcs) {
      const n = [x.note, note(x.row)].filter(Boolean).join('; ');
      lineage.push({ DOMAIN: domain, USUBJID: usubjid, SEQ: seq, RAW_FILE: x.row ? RAW_FILE_OF(x.row) : x.file, RECORD_ID: x.row ? x.row.RECORD_ID : '', NOTE: n });
    }
  };
  const srcOf = (obj: object, file: string, missingNote?: string): Src => {
    const row = R.src.get(obj);
    if (row && row.RECORD_ID && !isRemoved(row)) return { file, row };
    return { file, row: null, note: missingNote ?? 'Record not in raw export (restored by query)' };
  };
  const present = new Set<RawRow>();
  for (const f of R.files) for (const row of f.rows) present.add(row);
  const isRemoved = (row: RawRow) => !present.has(row);

  // ---- per-subject reference dates ----
  const ref = (s: TSubject): number | null => (s.firstDose ?? s.randDate ?? null);
  const dy = (s: TSubject, day: number | null) => (day === null || ref(s) === null ? null : studyDay(day, ref(s)!));
  const trtEnd = (s: TSubject) => (s.treated ? (s.eotReason === null ? Infinity : (s.eotDate ?? s.lastDose!)) : -Infinity);
  const epoch = (s: TSubject, day: number | null, minutes: number | null = null): string | null => {
    if (day === null) return null;
    if (s.screenFail) return 'SCREENING';
    if (day < s.consent) return null;
    if (!s.treated) return day <= s.randDate! ? 'SCREENING' : 'FOLLOW-UP';
    const fd = s.firstDose!;
    if (day < fd || (day === fd && minutes !== null && minutes < s.firstDoseTime!)) return 'SCREENING';
    if (day <= trtEnd(s)) return 'TREATMENT';
    return 'FOLLOW-UP';
  };
  const epochPartial = (s: TSubject, p: PartialDate): string | null => {
    const d = dayOfPartial(p);
    if (d !== null) return epoch(s, d);
    // earliest and latest possible dates of the partial date
    const lo = Date.UTC(p.y, (p.m ?? 1) - 1, 1) / 86400000;
    const hi = p.m === undefined ? Date.UTC(p.y, 11, 31) / 86400000 : Date.UTC(p.y, p.m, 0) / 86400000;
    const a = epoch(s, Math.max(lo, s.consent));
    const b = epoch(s, hi);
    return a === b ? a : null;
  };
  const fdt = (s: TSubject) => (s.firstDose !== null ? isoDT(s.firstDose, s.firstDoseTime!) : null);
  const seqSort = (rows: Row[], key: (r: Row) => string) => {
    rows.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
    let prev = '';
    let n = 0;
    for (const r of rows) {
      if (r.USUBJID !== prev) {
        prev = r.USUBJID as string;
        n = 0;
      }
      r._seq = ++n;
    }
  };
  const pad = (v: number | string | null | undefined, w = 12) => String(v ?? '').padStart(w, '0');

  /* ------------------------------ DM / SUPPDM ------------------------------ */
  const dm: Row[] = [];
  const suppdm: Row[] = [];
  for (const s of subjects) {
    const sr = R.subjRows.get(s)!;
    const race = s.races.length > 1 ? 'MULTIPLE' : s.races[0];
    const treatedPlanned = s.treated && !s.unplanned;
    const rfst = s.treated ? fdt(s) : s.randDate !== null ? iso(s.randDate) : null;
    const rfen = s.screenFail ? null : iso(s.eosDate ?? s.lastContact);
    dm.push({
      STUDYID, DOMAIN: 'DM', USUBJID: s.usubjid, SUBJID: s.subjid, RFSTDTC: rfst, RFENDTC: rfen, RFXSTDTC: fdt(s), RFXENDTC: s.lastDose !== null ? iso(s.lastDose) : null,
      RFICDTC: iso(s.consent), RFPENDTC: s.screenFail ? iso(s.sfDate!) : rfen, DTHDTC: s.deathDate !== null ? iso(s.deathDate) : null, DTHFL: s.deathDate !== null ? 'Y' : null,
      SITEID: s.site.siteId, BRTHDTC: String(s.birthYear), AGE: s.age, AGEU: 'YEARS', SEX: s.sex, RACE: race, ETHNIC: s.ethnic,
      ARMCD: s.arm, ARM: s.arm ? ARMS[s.arm].arm : null,
      ACTARMCD: treatedPlanned ? s.actualArm : null, ACTARM: treatedPlanned ? ARMS[s.actualArm!].arm : null,
      ARMNRS: s.screenFail ? 'SCREEN FAILURE' : !s.treated ? 'ASSIGNED, NOT TREATED' : s.unplanned ? 'UNPLANNED TREATMENT' : null,
      ACTARMUD: s.unplanned, COUNTRY: s.site.country.code, DMDTC: iso(s.screenDate), DMDY: dy(s, s.screenDate),
    });
    const srcs: Src[] = [{ file: 'enrollment.csv', row: sr.enr }, { file: 'demographics.csv', row: sr.dem }];
    if (!s.screenFail) {
      if (sr.rnd) srcs.push({ file: 'randomization.csv', row: sr.rnd });
      else srcs.push({ file: 'randomization.csv', row: null, note: R.restored.get(`${s.subjid}|RND`) });
      if (s.exCbx.length) srcs.push(srcOf(s.exCbx[0], 'ex_study_drug.csv', R.restored.get(`${s.subjid}|EX`)));
      if (sr.dth) srcs.push({ file: 'death.csv', row: sr.dth });
    }
    link('DM', s.usubjid, '', srcs);
    const q = (qnam: string, qlabel: string, qval: string | null, orig: string, row: RawRow | null, n?: string) => {
      if (qval === null || qval === '') return;
      suppdm.push({ STUDYID, RDOMAIN: 'DM', USUBJID: s.usubjid, IDVAR: null, IDVARVAL: null, QNAM: qnam, QLABEL: qlabel, QVAL: qval, QORIG: orig, QEVAL: null });
      link('SUPPDM', s.usubjid, '', [{ file: 'baseline_disease.csv', row, note: `QNAM=${qnam}${n ? `; ${n}` : ''}` }]);
    };
    if (s.races.length > 1) s.races.forEach((x, i) => q(`RACE${i + 1}`, `Race ${i + 1}`, x, 'Collected', sr.dem));
    if (s.raceOtherSp) q('RACEOTH', 'Race, Other', s.raceOtherSp.toUpperCase(), 'Collected', sr.dem);
    q('DISHIST', 'Histology', s.histology.toUpperCase(), 'Collected', sr.bd);
    q('DISSTAGE', 'Disease Stage at Study Entry', s.stage, 'Collected', sr.bd);
    q('PDL1TPS', 'PD-L1 Tumor Proportion Score (%)', String(s.pdl1), 'Collected', sr.bd, s.pdl1 === 0 ? 'raw "<1" or "0" standardized to 0' : undefined);
    q('PRLINES', 'Number of Prior Lines of Therapy', String(s.priorLines), 'Collected', sr.bd);
    q('PRIORIO', 'Prior Anti-PD-(L)1 Therapy', s.priorIO ? 'Y' : 'N', 'Collected', sr.bd);
    q('BRAINMET', 'Brain Metastases at Baseline', s.brainMets ? 'Y' : 'N', 'Collected', sr.bd);
    q('SMOKSTAT', 'Smoking Status', s.smoking, 'Collected', sr.bd);
    if (!s.screenFail) {
      const rr = sr.rnd ?? null;
      q('RANDNO', 'Randomization Number', s.randNo, 'Assigned', rr, rr ? undefined : R.restored.get(`${s.subjid}|RND`));
      q('STRATECG', 'Stratum: ECOG PS (IxRS)', String(s.stratEcog), 'Collected', rr, rr ? undefined : R.restored.get(`${s.subjid}|RND`));
      q('STRATIO', 'Stratum: Prior Anti-PD-(L)1 (IxRS)', s.stratIO ? 'Y' : 'N', 'Collected', rr, rr ? undefined : R.restored.get(`${s.subjid}|RND`));
    }
  }
  // fix lineage file names for SUPPDM race rows (they come from demographics)
  for (const l of lineage) if (l.DOMAIN === 'SUPPDM' && /QNAM=RACE/.test(String(l.NOTE))) l.RAW_FILE = 'demographics.csv';

  /* ------------------------------ AE / SUPPAE ------------------------------ */
  const ae: Row[] = [];
  const aeMeta = new Map<Row, { s: TSubject; a: TSubject['aes'][number] }>();
  for (const s of rnd)
    for (const a of s.aes) {
      const row = R.src.get(a)!;
      const st = a.startPartial ? isoPartial(a.startPartial) : iso(a.start);
      const en = a.end === null ? null : a.endPartial ? isoPartial(a.endPartial) : iso(a.end);
      const ser = a.serious;
      const yn = (b: boolean) => (ser ? (b ? 'Y' : 'N') : null);
      const x: Row = {
        STUDYID, DOMAIN: 'AE', USUBJID: s.usubjid, AESEQ: null, AESPID: row.AE_LINE, AETERM: a.verbatim, AEDECOD: a.pt, AEBODSYS: a.soc, AESOC: a.soc,
        AESER: ser ? 'Y' : 'N', AEACN: a.acnCbx, AEREL: a.relCbx === null ? null : a.relCbx === 'Y' ? 'RELATED' : 'NOT RELATED', AEOUT: a.outcome,
        AESCONG: yn(a.scong), AESDISAB: yn(a.sdisab), AESDTH: yn(a.sdth), AESHOSP: yn(a.shosp), AESLIFE: yn(a.slife), AESMIE: yn(a.smie),
        AETOXGR: String(a.grade), EPOCH: a.startPartial ? epochPartial(s, a.startPartial) : epoch(s, a.start), AESTDTC: st, AEENDTC: en,
        AESTDY: a.startPartial ? null : dy(s, a.start), AEENDY: a.end === null || a.endPartial ? null : dy(s, a.end),
        AEENRTPT: a.end === null ? 'ONGOING' : null, AEENTPT: a.end === null ? (s.eosReason ? 'END OF STUDY' : 'DATA CUTOFF') : null,
      };
      ae.push(x);
      aeMeta.set(x, { s, a });
    }
  seqSort(ae, (r) => `${r.USUBJID}|${r.AESTDTC}|${r.AEDECOD}|${pad(r.AESPID, 4)}`);
  const suppae: Row[] = [];
  for (const x of ae) {
    x.AESEQ = x._seq as number;
    const { a } = aeMeta.get(x)!;
    const row = R.src.get(a)!;
    link('AE', x.USUBJID as string, x.AESEQ, [{ file: 'ae.csv', row }]);
    for (const [qnam, qlabel, qval] of [
      ['AERELDOC', 'Relationship to Docetaxel', a.relDoc === 'Y' ? 'RELATED' : 'NOT RELATED'],
      ['AEACNDOC', 'Action Taken with Docetaxel', a.acnDoc],
    ]) {
      suppae.push({ STUDYID, RDOMAIN: 'AE', USUBJID: x.USUBJID, IDVAR: 'AESEQ', IDVARVAL: String(x.AESEQ), QNAM: qnam, QLABEL: qlabel, QVAL: qval, QORIG: 'Collected', QEVAL: 'INVESTIGATOR' });
      link('SUPPAE', x.USUBJID as string, x.AESEQ as number, [{ file: 'ae.csv', row, note: `QNAM=${qnam}` }]);
    }
  }

  /* ------------------------------ CM ------------------------------ */
  const cm: Row[] = [];
  const cmMeta = new Map<Row, object>();
  for (const s of rnd)
    for (const c of s.cms) {
      const row = R.src.get(c)!;
      const d = CM_CATALOG[c.name];
      const stDay = dayOfPartial(c.start);
      const enDay = c.end ? dayOfPartial(c.end) : null;
      const x: Row = {
        STUDYID, DOMAIN: 'CM', USUBJID: s.usubjid, CMSEQ: null, CMSPID: row.CM_LINE, CMTRT: c.verbatim, CMDECOD: c.name, CMCAT: c.category, CMCLAS: d.atc,
        CMINDC: c.indication, CMDOSE: c.dose, CMDOSU: c.unit ? UNIT_MAP[c.unit] : null, CMDOSFRQ: c.freq ? FREQ_MAP[c.freq] : null, CMROUTE: ROUTE_MAP[c.route],
        EPOCH: epochPartial(s, c.start), CMSTDTC: isoPartial(c.start), CMENDTC: c.end ? isoPartial(c.end) : null,
        CMSTDY: stDay !== null ? dy(s, stDay) : null, CMENDY: enDay !== null ? dy(s, enDay) : null,
        CMENRTPT: c.ongoing ? 'ONGOING' : null, CMENTPT: c.ongoing ? (s.eosReason ? 'END OF STUDY' : 'DATA CUTOFF') : null,
      };
      cm.push(x);
      cmMeta.set(x, c);
    }
  seqSort(cm, (r) => `${r.USUBJID}|${r.CMSTDTC}|${r.CMDECOD}|${pad(r.CMSPID, 4)}`);
  for (const x of cm) {
    x.CMSEQ = x._seq as number;
    link('CM', x.USUBJID as string, x.CMSEQ, [{ file: 'cm.csv', row: R.src.get(cmMeta.get(x)!)! }]);
  }

  /* ------------------------------ MH ------------------------------ */
  const mh: Row[] = [];
  const mhSrc = new Map<Row, Src>();
  for (const s of rnd) {
    const bd = R.subjRows.get(s)!.bd;
    const x0: Row = {
      STUDYID, DOMAIN: 'MH', USUBJID: s.usubjid, MHSEQ: null, MHSPID: null, MHTERM: `NON-SMALL CELL LUNG CANCER (${s.histology.toUpperCase()})`, MHDECOD: 'Non-small cell lung cancer',
      MHBODSYS: SOC.neo, MHCAT: 'PRIMARY DIAGNOSIS', MHSTDTC: isoPartial(s.diagDate), MHENRTPT: 'ONGOING', MHENTPT: 'SCREENING', MHDTC: iso(s.consent),
    };
    mh.push(x0);
    mhSrc.set(x0, { file: 'baseline_disease.csv', row: bd, note: 'Primary diagnosis from baseline disease form (HISTOLOGY, DIAG_DATE)' });
    for (const m of s.mhs) {
      const row = R.src.get(m)!;
      const x: Row = {
        STUDYID, DOMAIN: 'MH', USUBJID: s.usubjid, MHSEQ: null, MHSPID: m.enteredOnAePage ? `AE-${row.AE_LINE}` : row.MH_LINE, MHTERM: m.verbatim, MHDECOD: m.pt, MHBODSYS: m.soc,
        MHCAT: 'GENERAL MEDICAL HISTORY', MHSTDTC: isoPartial(m.start), MHENRTPT: m.ongoing ? 'ONGOING' : null, MHENTPT: m.ongoing ? 'SCREENING' : null, MHDTC: iso(s.consent),
      };
      mh.push(x);
      mhSrc.set(x, { file: m.enteredOnAePage ? 'ae.csv' : 'mh.csv', row, note: m.enteredOnAePage ? 'Entered on the AE page; reclassified to medical history by query' : undefined });
    }
  }
  seqSort(mh, (r) => `${r.USUBJID}|${r.MHCAT === 'PRIMARY DIAGNOSIS' ? 0 : 1}|${r.MHSTDTC}|${r.MHDECOD}`);
  for (const x of mh) {
    x.MHSEQ = x._seq as number;
    link('MH', x.USUBJID as string, x.MHSEQ, [mhSrc.get(x)!]);
  }

  /* ------------------------------ EX ------------------------------ */
  const ex: Row[] = [];
  const exSrc = new Map<Row, Src>();
  for (const s of rnd) {
    for (const [i, e] of s.exCbx.entries()) {
      const v = cycleVisit(e.cycle);
      const x: Row = {
        STUDYID, DOMAIN: 'EX', USUBJID: s.usubjid, EXSEQ: null, EXREFID: e.kit, EXTRT: e.content, EXDOSE: e.dose, EXDOSU: 'mg', EXDOSFRM: 'TABLET', EXDOSFRQ: 'QD', EXROUTE: 'ORAL',
        EXADJ: e.reason, VISITNUM: v.num, VISIT: v.name, EPOCH: 'TREATMENT', EXSTDTC: i === 0 && e.time !== null ? isoDT(e.start, e.time) : iso(e.start), EXENDTC: iso(e.end),
        EXSTDY: dy(s, e.start), EXENDY: dy(s, e.end),
      };
      ex.push(x);
      exSrc.set(x, srcOf(e, 'ex_study_drug.csv', R.restored.get(`${s.subjid}|EX`)));
    }
    for (const e of s.exDoc) {
      const v = cycleVisit(e.cycle);
      const x: Row = {
        STUDYID, DOMAIN: 'EX', USUBJID: s.usubjid, EXSEQ: null, EXREFID: null, EXTRT: 'DOCETAXEL', EXDOSE: e.doseMg, EXDOSU: 'mg', EXDOSFRM: 'INJECTION, SOLUTION, CONCENTRATE',
        EXDOSFRQ: 'ONCE', EXROUTE: 'INTRAVENOUS', EXADJ: e.reason, VISITNUM: v.num, VISIT: v.name, EPOCH: 'TREATMENT', EXSTDTC: isoDT(e.date, e.time), EXENDTC: isoDT(e.date, e.time + 60),
        EXSTDY: dy(s, e.date), EXENDY: dy(s, e.date),
      };
      ex.push(x);
      exSrc.set(x, srcOf(e, 'ex_docetaxel.csv', R.restored.get(`${s.subjid}|EX`)));
    }
  }
  seqSort(ex, (r) => `${r.USUBJID}|${String(r.EXSTDTC).slice(0, 10)}|${r.EXTRT === 'DOCETAXEL' ? 1 : 0}|${r.EXSTDTC}`);
  for (const x of ex) {
    x.EXSEQ = x._seq as number;
    link('EX', x.USUBJID as string, x.EXSEQ, [exSrc.get(x)!]);
  }

  /* ------------------------------ LB ------------------------------ */
  const lb: Row[] = [];
  const lbSrc = new Map<Row, Src>();
  for (const s of rnd) {
    const lob = new Map<string, Row>();
    for (const l of s.labs) {
      const t = LAB[l.code];
      const row = R.src.get(l)!;
      const nrind = l.notDone ? null : l.std < l.stdLo ? 'LOW' : l.std > l.stdHi ? 'HIGH' : 'NORMAL';
      const x: Row = {
        STUDYID, DOMAIN: 'LB', USUBJID: s.usubjid, LBSEQ: null, LBREFID: l.accession, LBTESTCD: t.code, LBTEST: t.name, LBCAT: t.cat,
        LBORRES: l.notDone ? null : l.orig, LBORRESU: l.notDone ? null : l.origUnit, LBORNRLO: l.origLo, LBORNRHI: l.origHi,
        LBSTRESC: l.notDone ? null : String(l.std), LBSTRESN: l.notDone ? null : l.std, LBSTRESU: l.notDone ? null : t.unit, LBSTNRLO: l.stdLo, LBSTNRHI: l.stdHi,
        LBNRIND: nrind, LBSTAT: l.notDone ? 'NOT DONE' : null, LBREASND: l.notDone ? row.RESULT_COMMENT : null,
        LBNAM: l.local ? `LOCAL LAB (SITE ${s.site.siteId})` : 'CENTRAL LAB', LBSPEC: t.spec, LBLOBXFL: null,
        VISITNUM: l.visitNum, VISIT: l.visitName, EPOCH: epoch(s, l.date, l.time), LBDTC: isoDT(l.date, l.time), LBDY: dy(s, l.date),
      };
      lb.push(x);
      const conv = l.local && t.local.unit !== t.unit ? `LBORRES in ${t.local.unit} converted to ${t.unit}${t.local.factor !== 1 ? ` (x${t.local.factor})` : ' (same numeric value)'}` : undefined;
      lbSrc.set(x, { file: 'labs.csv', row, note: conv });
      if (s.treated && !l.notDone && (l.date < s.firstDose! || (l.date === s.firstDose && l.time < s.firstDoseTime!))) {
        const prev = lob.get(t.code);
        if (!prev || String(prev.LBDTC) <= String(x.LBDTC)) lob.set(t.code, x);
      }
    }
    for (const x of lob.values()) x.LBLOBXFL = 'Y';
  }
  seqSort(lb, (r) => `${r.USUBJID}|${r.LBCAT}|${r.LBTESTCD}|${pad(Math.round(Number(r.VISITNUM) * 100), 8)}|${r.LBDTC}`);
  for (const x of lb) {
    x.LBSEQ = x._seq as number;
    link('LB', x.USUBJID as string, x.LBSEQ, [lbSrc.get(x)!]);
  }

  /* ------------------------------ VS ------------------------------ */
  const vs: Row[] = [];
  const vsSrc = new Map<Row, Src>();
  for (const s of rnd) {
    const lob = new Map<string, Row>();
    for (const v of s.vitals) {
      const row = R.src.get(v)!;
      for (const t of VS_TESTS) {
        let orres: string;
        let oru: string = t.unit;
        let stres: number;
        let n: string | undefined;
        if (t.code === 'HEIGHT') {
          if (v.height === null) continue;
          orres = String(v.height);
          stres = v.height;
        } else if (t.code === 'TEMP') {
          if (v.tempF !== undefined) {
            orres = v.tempF.toFixed(1);
            oru = 'F';
            stres = Math.round((((v.tempF - 32) * 5) / 9) * 10) / 10;
            n = 'VSORRES in F converted to C: (F - 32) x 5/9';
          } else {
            orres = v.temp.toFixed(1);
            stres = v.temp;
          }
        } else if (t.code === 'WEIGHT') {
          if (v.weightLb !== undefined) {
            orres = v.weightLb.toFixed(1);
            oru = 'LB';
            stres = Math.round(v.weightLb * 0.45359237 * 10) / 10;
            n = 'VSORRES in lb converted to kg: x 0.45359237';
          } else {
            orres = v.weight.toFixed(1);
            stres = v.weight;
          }
        } else {
          const val = t.code === 'SYSBP' ? v.sysbp : t.code === 'DIABP' ? v.diabp : v.pulse;
          orres = String(val);
          stres = val;
        }
        const x: Row = {
          STUDYID, DOMAIN: 'VS', USUBJID: s.usubjid, VSSEQ: null, VSTESTCD: t.code, VSTEST: t.name, VSPOS: ['SYSBP', 'DIABP', 'PULSE'].includes(t.code) ? 'SITTING' : null,
          VSORRES: orres, VSORRESU: oru, VSSTRESC: String(stres), VSSTRESN: stres, VSSTRESU: t.unit, VSLOBXFL: null,
          VISITNUM: v.visitNum, VISIT: v.visitName, EPOCH: epoch(s, v.date, v.time), VSDTC: isoDT(v.date, v.time), VSDY: dy(s, v.date),
        };
        vs.push(x);
        vsSrc.set(x, { file: 'vitals.csv', row, note: n });
        if (s.treated && (v.date < s.firstDose! || (v.date === s.firstDose && v.time < s.firstDoseTime!))) {
          const prev = lob.get(t.code);
          if (!prev || String(prev.VSDTC) <= String(x.VSDTC)) lob.set(t.code, x);
        }
      }
    }
    for (const x of lob.values()) x.VSLOBXFL = 'Y';
  }
  seqSort(vs, (r) => `${r.USUBJID}|${r.VSTESTCD}|${pad(Math.round(Number(r.VISITNUM) * 100), 8)}|${r.VSDTC}`);
  for (const x of vs) {
    x.VSSEQ = x._seq as number;
    link('VS', x.USUBJID as string, x.VSSEQ, [vsSrc.get(x)!]);
  }

  /* ------------------------------ EG ------------------------------ */
  const eg: Row[] = [];
  const egSrc = new Map<Row, Src>();
  for (const s of rnd) {
    const lob = new Map<string, Row>();
    for (const e of s.ecgs) {
      const row = R.src.get(e)!;
      const tests: [string, string, string, string | null, number | null, string | null][] = [
        ['QTCFAG', 'QTcF Interval, Aggregate', String(e.qtcf), 'ms', e.qtcf, 'ms'],
        ['EGHRMN', 'ECG Mean Heart Rate', String(e.hr), 'beats/min', e.hr, 'beats/min'],
        ['INTP', 'Interpretation', e.interp.toUpperCase(), null, null, null],
      ];
      for (const [cd, name, orres, oru, stn, stu] of tests) {
        const x: Row = {
          STUDYID, DOMAIN: 'EG', USUBJID: s.usubjid, EGSEQ: null, EGTESTCD: cd, EGTEST: name, EGORRES: orres, EGORRESU: oru,
          EGSTRESC: cd === 'INTP' ? (e.interp === 'Normal' ? 'NORMAL' : 'ABNORMAL') : String(stn), EGSTRESN: stn, EGSTRESU: stu, EGLOBXFL: null,
          VISITNUM: e.visitNum, VISIT: e.visitName, EPOCH: epoch(s, e.date, e.time), EGDTC: isoDT(e.date, e.time), EGDY: dy(s, e.date),
        };
        eg.push(x);
        egSrc.set(x, { file: 'ecg.csv', row });
        if (s.treated && (e.date < s.firstDose! || (e.date === s.firstDose && e.time < s.firstDoseTime!))) {
          const prev = lob.get(cd);
          if (!prev || String(prev.EGDTC) <= String(x.EGDTC)) lob.set(cd, x);
        }
      }
    }
    for (const x of lob.values()) x.EGLOBXFL = 'Y';
  }
  seqSort(eg, (r) => `${r.USUBJID}|${r.EGTESTCD}|${pad(Math.round(Number(r.VISITNUM) * 100), 8)}|${r.EGDTC}`);
  for (const x of eg) {
    x.EGSEQ = x._seq as number;
    link('EG', x.USUBJID as string, x.EGSEQ, [egSrc.get(x)!]);
  }

  /* ------------------------------ TR / RS ------------------------------ */
  const tr: Row[] = [];
  const rs: Row[] = [];
  const trSrc = new Map<Row, Src>();
  const rsSrc = new Map<Row, Src>();
  for (const s of rnd) {
    s.scans.forEach((sc, k) => {
      const row = R.src.get(sc)!;
      const grp = `A${k + 1}`;
      const lobx = s.treated && sc.baseline && sc.date < s.firstDose! ? 'Y' : null;
      const x: Row = {
        STUDYID, DOMAIN: 'TR', USUBJID: s.usubjid, TRSEQ: null, TRLNKGRP: grp, TRTESTCD: 'SUMDIAM', TRTEST: 'Sum of Diameter',
        TRORRES: sc.sld === null ? null : String(sc.sld), TRORRESU: sc.sld === null ? null : 'mm', TRSTRESC: sc.sld === null ? null : String(sc.sld), TRSTRESN: sc.sld, TRSTRESU: sc.sld === null ? null : 'mm',
        TRSTAT: sc.sld === null ? 'NOT DONE' : null, TRREASND: sc.sld === null ? 'NOT EVALUABLE (IMAGE QUALITY)' : null, TRMETHOD: sc.method, TREVAL: 'INVESTIGATOR', TRLOBXFL: lobx,
        VISITNUM: sc.visitNum, VISIT: sc.visitName, EPOCH: epoch(s, sc.date), TRDTC: iso(sc.date), TRDY: dy(s, sc.date),
      };
      tr.push(x);
      trSrc.set(x, { file: 'tumor_assessment.csv', row });
      if (sc.baseline) return;
      const tests: [string, string, string][] = [['OVRLRESP', 'Overall Response', sc.resp!]];
      for (const [cd, name, val] of tests) {
        const y: Row = {
          STUDYID, DOMAIN: 'RS', USUBJID: s.usubjid, RSSEQ: null, RSLNKGRP: grp, RSTESTCD: cd, RSTEST: name, RSCAT: 'RECIST 1.1', RSORRES: val, RSSTRESC: val, RSSTRESN: null,
          RSEVAL: 'INVESTIGATOR', RSLOBXFL: null, VISITNUM: sc.visitNum, VISIT: sc.visitName, EPOCH: epoch(s, sc.date), RSDTC: iso(sc.date), RSDY: dy(s, sc.date),
        };
        rs.push(y);
        rsSrc.set(y, { file: 'tumor_assessment.csv', row });
      }
    });
    let lastPre: Row | null = null;
    for (const v of s.vitals) {
      if (v.ecog === null) continue;
      const row = R.src.get(v)!;
      const y: Row = {
        STUDYID, DOMAIN: 'RS', USUBJID: s.usubjid, RSSEQ: null, RSLNKGRP: null, RSTESTCD: 'ECOG101', RSTEST: 'ECOG1-Performance Status', RSCAT: 'ECOG', RSORRES: ECOG_TEXT[v.ecog],
        RSSTRESC: String(v.ecog), RSSTRESN: v.ecog, RSEVAL: 'INVESTIGATOR', RSLOBXFL: null, VISITNUM: v.visitNum, VISIT: v.visitName, EPOCH: epoch(s, v.date, v.time),
        RSDTC: isoDT(v.date, v.time), RSDY: dy(s, v.date),
      };
      rs.push(y);
      rsSrc.set(y, { file: 'vitals.csv', row, note: 'ECOG collected on the vital signs form; numeric grade mapped to ECOG101 CT text' });
      if (s.treated && (v.date < s.firstDose! || (v.date === s.firstDose && v.time < s.firstDoseTime!))) lastPre = y;
    }
    if (lastPre) lastPre.RSLOBXFL = 'Y';
  }
  seqSort(tr, (r) => `${r.USUBJID}|${r.TRDTC}|${pad(Math.round(Number(r.VISITNUM) * 100), 8)}`);
  for (const x of tr) {
    x.TRSEQ = x._seq as number;
    link('TR', x.USUBJID as string, x.TRSEQ, [trSrc.get(x)!]);
  }
  const rsOrder: Record<string, number> = { OVRLRESP: 0, NTRGRESP: 1, NEWLIND: 2, ECOG101: 3 };
  seqSort(rs, (r) => `${r.USUBJID}|${r.RSCAT === 'ECOG' ? 1 : 0}|${String(r.RSDTC).slice(0, 10)}|${rsOrder[r.RSTESTCD as string]}`);
  for (const x of rs) {
    x.RSSEQ = x._seq as number;
    link('RS', x.USUBJID as string, x.RSSEQ, [rsSrc.get(x)!]);
  }

  /* ------------------------------ DS / DD / SS / DV ------------------------------ */
  const ds: Row[] = [];
  const dsSrc = new Map<Row, Src>();
  const dd: Row[] = [];
  const ss: Row[] = [];
  const ssSrc = new Map<Row, Src>();
  const dv: Row[] = [];
  const dvSrc = new Map<Row, Src>();
  for (const s of subjects) {
    const sr = R.subjRows.get(s)!;
    const add = (o: Partial<Row> & { DSSTDTC: string }, src: Src, day: number) => {
      const x: Row = {
        STUDYID, DOMAIN: 'DS', USUBJID: s.usubjid, DSSEQ: null, DSTERM: o.DSTERM ?? null, DSDECOD: o.DSDECOD ?? null, DSCAT: o.DSCAT ?? null, DSSCAT: o.DSSCAT ?? null,
        EPOCH: epoch(s, day), DSSTDTC: o.DSSTDTC, DSSTDY: dy(s, day),
      };
      ds.push(x);
      dsSrc.set(x, src);
    };
    add({ DSTERM: 'INFORMED CONSENT OBTAINED', DSDECOD: 'INFORMED CONSENT OBTAINED', DSCAT: 'PROTOCOL MILESTONE', DSSTDTC: iso(s.consent) }, { file: 'enrollment.csv', row: sr.enr }, s.consent);
    if (s.screenFail) {
      add({ DSTERM: s.sfReason!, DSDECOD: 'SCREEN FAILURE', DSCAT: 'DISPOSITION EVENT', DSSCAT: 'STUDY PARTICIPATION', DSSTDTC: iso(s.sfDate!) }, { file: 'enrollment.csv', row: sr.enr }, s.sfDate!);
      continue;
    }
    add({ DSTERM: 'RANDOMIZED', DSDECOD: 'RANDOMIZED', DSCAT: 'PROTOCOL MILESTONE', DSSTDTC: iso(s.randDate!) }, sr.rnd ? { file: 'randomization.csv', row: sr.rnd } : { file: 'randomization.csv', row: null, note: R.restored.get(`${s.subjid}|RND`) }, s.randDate!);
    if (sr.eot) {
      const d = s.treated ? (s.eotDate ?? (s.eotReason === 'DEATH' ? s.deathDate : null) ?? s.withdrawalDate ?? s.lastDose!) : (s.withdrawalDate ?? s.deathDate ?? s.randDate! + 3);
      const decod = s.treated ? s.eotReason! : s.neverTreatedReason!;
      add({ DSTERM: sr.eot.EOT_REASON.toUpperCase(), DSDECOD: decod, DSCAT: 'DISPOSITION EVENT', DSSCAT: 'STUDY TREATMENT', DSSTDTC: iso(d) }, { file: 'eot.csv', row: sr.eot }, d);
    }
    if (sr.eos) add({ DSTERM: sr.eos.EOS_REASON.toUpperCase(), DSDECOD: s.eosReason!, DSCAT: 'DISPOSITION EVENT', DSSCAT: 'STUDY PARTICIPATION', DSSTDTC: iso(s.eosDate!) }, { file: 'eos.csv', row: sr.eos }, s.eosDate!);
    if (s.deathDate !== null && sr.dth) {
      const cause = s.deathCause ?? 'Unknown';
      const spec = sr.dth.DEATH_CAUSE_SPEC;
      dd.push({
        STUDYID, DOMAIN: 'DD', USUBJID: s.usubjid, DDSEQ: 1, DDTESTCD: 'PRCDTH', DDTEST: 'Primary Cause of Death', DDORRES: spec ? `${cause}: ${spec}` : cause,
        DDSTRESC: cause.toUpperCase(), EPOCH: epoch(s, s.deathDate), DDDTC: iso(s.deathDate), DDDY: dy(s, s.deathDate),
      });
      link('DD', s.usubjid, 1, [{ file: 'death.csv', row: sr.dth }]);
    }
    for (const c of s.contacts) {
      const v = survVisit(c.n);
      const x: Row = {
        STUDYID, DOMAIN: 'SS', USUBJID: s.usubjid, SSSEQ: null, SSTESTCD: 'SURVSTAT', SSTEST: 'Survival Status',
        SSORRES: c.status === 'Alive' ? 'ALIVE' : c.status === 'Dead' ? 'DEAD' : 'UNKNOWN', SSSTRESC: c.status === 'Alive' ? 'ALIVE' : c.status === 'Dead' ? 'DEAD' : 'UNKNOWN',
        VISITNUM: v.num, VISIT: v.name, EPOCH: epoch(s, c.date), SSDTC: iso(c.date), SSDY: dy(s, c.date),
      };
      ss.push(x);
      ssSrc.set(x, { file: 'survival_followup.csv', row: R.src.get(c)!, note: c.status === 'Lost to follow-up' ? 'STATUS "Lost to follow-up" mapped to UNKNOWN' : undefined });
    }
    for (const d of s.dvs) {
      const row = R.src.get(d)!;
      const x: Row = {
        STUDYID, DOMAIN: 'DV', USUBJID: s.usubjid, DVSEQ: null, DVREFID: row.DV_ID, DVTERM: d.description, DVCAT: d.category, DVSCAT: d.severity.toUpperCase(),
        EPOCH: epoch(s, d.date), DVSTDTC: iso(d.date), DVSTDY: dy(s, d.date),
      };
      dv.push(x);
      dvSrc.set(x, { file: 'deviations.csv', row });
    }
  }
  const dsOrd = (r: Row) => (r.DSDECOD === 'INFORMED CONSENT OBTAINED' ? 0 : r.DSDECOD === 'RANDOMIZED' ? 1 : r.DSSCAT === 'STUDY TREATMENT' ? 2 : 3);
  seqSort(ds, (r) => `${r.USUBJID}|${r.DSSTDTC}|${dsOrd(r)}`);
  for (const x of ds) {
    x.DSSEQ = x._seq as number;
    link('DS', x.USUBJID as string, x.DSSEQ, [dsSrc.get(x)!]);
  }
  seqSort(ss, (r) => `${r.USUBJID}|${r.SSDTC}`);
  for (const x of ss) {
    x.SSSEQ = x._seq as number;
    link('SS', x.USUBJID as string, x.SSSEQ, [ssSrc.get(x)!]);
  }
  seqSort(dv, (r) => `${r.USUBJID}|${r.DVSTDTC}|${r.DVREFID}`);
  for (const x of dv) {
    x.DVSEQ = x._seq as number;
    link('DV', x.USUBJID as string, x.DVSEQ, [dvSrc.get(x)!]);
  }

  /* ------------------------------ SV ------------------------------ */
  const sv: Row[] = [];
  const svMap = new Map<string, { s: TSubject; num: number; name: string; dates: number[]; unsKind: Set<string> }>();
  const svAdd = (s: TSubject, num: number | null, name: string | null, day: number, kind: string) => {
    if (num === null || name === null) return;
    const k = `${s.usubjid}|${num}`;
    if (!svMap.has(k)) svMap.set(k, { s, num, name, dates: [], unsKind: new Set() });
    const e = svMap.get(k)!;
    e.dates.push(day);
    if (name === 'UNSCHEDULED') e.unsKind.add(kind);
  };
  for (const s of rnd) {
    for (const l of s.labs) svAdd(s, l.visitNum, l.visitName, l.date, 'laboratory');
    for (const v of s.vitals) svAdd(s, v.visitNum, v.visitName, v.date, 'vital signs');
    for (const e of s.ecgs) svAdd(s, e.visitNum, e.visitName, e.date, 'ECG');
    for (const sc of s.scans) svAdd(s, sc.visitNum, sc.visitName, sc.date, 'tumor');
    for (const e of s.exDoc) svAdd(s, cycleVisit(e.cycle).num, cycleVisit(e.cycle).name, e.date, 'dosing');
    for (const c of s.contacts) svAdd(s, survVisit(c.n).num, survVisit(c.n).name, c.date, 'contact');
  }
  for (const e of svMap.values()) {
    const a = Math.min(...e.dates);
    const b = Math.max(...e.dates);
    sv.push({
      STUDYID, DOMAIN: 'SV', USUBJID: e.s.usubjid, VISITNUM: e.num, VISIT: e.name,
      SVUPDES: e.name === 'UNSCHEDULED' ? `Unscheduled ${[...e.unsKind].sort().join(' and ')} assessment` : null,
      EPOCH: epoch(e.s, a), SVSTDTC: iso(a), SVENDTC: iso(b), SVSTDY: dy(e.s, a), SVENDY: dy(e.s, b),
    });
  }
  sv.sort((x, y) => (x.USUBJID === y.USUBJID ? Number(x.VISITNUM) - Number(y.VISITNUM) : String(x.USUBJID) < String(y.USUBJID) ? -1 : 1));
  for (const x of sv) link('SV', x.USUBJID as string, String(x.VISITNUM), [{ file: '(derived)', row: null, note: 'Derived: first/last date of visit-based records (LB, VS, EG, TR/RS, EX, SS) with this VISITNUM' }]);

  /* ------------------------------ SE ------------------------------ */
  const se: Row[] = [];
  for (const s of subjects) {
    const els: Row[] = [];
    const endScr = s.screenFail ? iso(s.sfDate!) : s.treated ? fdt(s) : iso(s.randDate!);
    els.push({ ETCD: 'SCRN', ELEMENT: 'Screening', SEUPDES: null, TAETORD: 1, EPOCH: 'SCREENING', SESTDTC: iso(s.consent), SEENDTC: endScr, SESTDY: dy(s, s.consent), SEENDY: s.screenFail ? null : dy(s, s.treated ? s.firstDose : s.randDate) });
    if (s.treated) {
      const end = s.eotReason === null ? null : (s.eotDate ?? s.lastDose!);
      const unpl = s.unplanned !== null;
      const etcd = unpl ? 'UNPLAN' : s.actualArm === 'CBX+DOC' ? 'CBXDOC' : 'PBODOC';
      els.push({ ETCD: etcd, ELEMENT: unpl ? null : etcd === 'CBXDOC' ? 'CBX-417 + Docetaxel' : 'Placebo + Docetaxel', SEUPDES: s.unplanned, TAETORD: unpl ? null : 2, EPOCH: 'TREATMENT', SESTDTC: fdt(s), SEENDTC: end !== null ? iso(end) : null, SESTDY: dy(s, s.firstDose), SEENDY: end !== null ? dy(s, end) : null });
      if (end !== null) {
        const fuEnd = s.eosDate ?? null;
        els.push({ ETCD: 'FU', ELEMENT: 'Follow-up', SEUPDES: null, TAETORD: 3, EPOCH: 'FOLLOW-UP', SESTDTC: iso(end), SEENDTC: fuEnd !== null ? iso(fuEnd) : null, SESTDY: dy(s, end), SEENDY: fuEnd !== null ? dy(s, fuEnd) : null });
      }
    } else if (!s.screenFail) {
      els.push({ ETCD: 'FU', ELEMENT: 'Follow-up', SEUPDES: null, TAETORD: 3, EPOCH: 'FOLLOW-UP', SESTDTC: iso(s.randDate!), SEENDTC: s.eosDate !== null ? iso(s.eosDate) : null, SESTDY: dy(s, s.randDate), SEENDY: s.eosDate !== null ? dy(s, s.eosDate) : null });
    }
    els.forEach((e, i) => {
      se.push({ STUDYID, DOMAIN: 'SE', USUBJID: s.usubjid, SESEQ: i + 1, ...e });
      link('SE', s.usubjid, i + 1, [{ file: '(derived)', row: null, note: 'Derived from consent, first/last dose, end-of-treatment and end-of-study dates' }]);
    });
  }

  /* ------------------------------ Trial design: TA / TE / TS ------------------------------ */
  const ta: Row[] = [];
  for (const armcd of ['CBX+DOC', 'PBO+DOC'] as const) {
    const trtEl = armcd === 'CBX+DOC' ? ['CBXDOC', 'CBX-417 + Docetaxel'] : ['PBODOC', 'Placebo + Docetaxel'];
    ta.push({ STUDYID, DOMAIN: 'TA', ARMCD: armcd, ARM: ARMS[armcd].arm, TAETORD: 1, ETCD: 'SCRN', ELEMENT: 'Screening', TABRANCH: `Randomized to ${ARMS[armcd].arm}`, TATRANS: null, EPOCH: 'SCREENING' });
    ta.push({ STUDYID, DOMAIN: 'TA', ARMCD: armcd, ARM: ARMS[armcd].arm, TAETORD: 2, ETCD: trtEl[0], ELEMENT: trtEl[1], TABRANCH: null, TATRANS: 'If study treatment discontinued, go to Follow-up', EPOCH: 'TREATMENT' });
    ta.push({ STUDYID, DOMAIN: 'TA', ARMCD: armcd, ARM: ARMS[armcd].arm, TAETORD: 3, ETCD: 'FU', ELEMENT: 'Follow-up', TABRANCH: null, TATRANS: null, EPOCH: 'FOLLOW-UP' });
  }
  const te: Row[] = [
    { STUDYID, DOMAIN: 'TE', ETCD: 'SCRN', ELEMENT: 'Screening', TESTRL: 'Informed consent', TEENRL: 'First dose of study treatment (or randomization if never treated)', TEDUR: 'P28D' },
    { STUDYID, DOMAIN: 'TE', ETCD: 'CBXDOC', ELEMENT: 'CBX-417 + Docetaxel', TESTRL: 'First dose of CBX-417 or docetaxel', TEENRL: 'End-of-treatment visit (or last dose)', TEDUR: null },
    { STUDYID, DOMAIN: 'TE', ETCD: 'PBODOC', ELEMENT: 'Placebo + Docetaxel', TESTRL: 'First dose of placebo or docetaxel', TEENRL: 'End-of-treatment visit (or last dose)', TEDUR: null },
    { STUDYID, DOMAIN: 'TE', ETCD: 'FU', ELEMENT: 'Follow-up', TESTRL: 'End of treatment element', TEENRL: 'Death, withdrawal, loss to follow-up or end of study', TEDUR: null },
  ];
  const tsList: [string, string, string][] = [
    ['TITLE', 'Trial Title', 'A Phase 2/3, Randomized, Double-Blind, Placebo-Controlled, Multicenter Study of CBX-417 plus Docetaxel versus Placebo plus Docetaxel in Adults with Previously Treated Advanced or Metastatic Non-Small Cell Lung Cancer'],
    ['SPONSOR', 'Clinical Study Sponsor', 'Halden Therapeutics (fictional)'],
    ['TPHASE', 'Trial Phase Classification', 'PHASE II/III TRIAL'],
    ['STYPE', 'Study Type', 'INTERVENTIONAL'],
    ['TTYPE', 'Trial Type', 'EFFICACY'],
    ['TTYPE', 'Trial Type', 'SAFETY'],
    ['INTMODEL', 'Intervention Model', 'PARALLEL'],
    ['INTTYPE', 'Intervention Type', 'DRUG'],
    ['TBLIND', 'Trial Blinding Schema', 'DOUBLE BLIND'],
    ['TCNTRL', 'Control Type', 'PLACEBO'],
    ['TINDTP', 'Trial Intent Type', 'TREATMENT'],
    ['RANDOM', 'Trial is Randomized', 'Y'],
    ['RANDQT', 'Randomization Quotient', '0.5'],
    ['STRATFCT', 'Stratification Factor', 'ECOG PERFORMANCE STATUS (0 VS 1)'],
    ['STRATFCT', 'Stratification Factor', 'PRIOR ANTI-PD-(L)1 THERAPY (YES VS NO)'],
    ['NARMS', 'Planned Number of Arms', '2'],
    ['PLANSUB', 'Planned Number of Subjects', '420'],
    ['ACTSUB', 'Actual Number of Subjects', '420'],
    ['AGEMIN', 'Planned Minimum Age of Subjects', 'P18Y'],
    ['SEXPOP', 'Sex of Participants', 'BOTH'],
    ['INDIC', 'Trial Disease/Condition Indication', 'Previously treated advanced or metastatic non-small cell lung cancer'],
    ['TRT', 'Investigational Therapy or Treatment', 'CBX-417'],
    ['CURTRT', 'Current Therapy or Treatment', 'DOCETAXEL'],
    ['COMPTRT', 'Comparative Treatment Name', 'PLACEBO'],
    ['DOSE', 'Dose per Administration', '200'],
    ['DOSU', 'Dose Units', 'mg'],
    ['DOSFRQ', 'Dosing Frequency', 'QD'],
    ['ROUTE', 'Route of Administration', 'ORAL'],
    ['DOSFRM', 'Dose Form', 'TABLET'],
    ['OBJPRIM', 'Trial Primary Objective', 'To compare progression-free survival (investigator, RECIST 1.1) between CBX-417 + docetaxel and placebo + docetaxel'],
    ['OBJSEC', 'Trial Secondary Objective', 'To compare overall survival between treatment arms'],
    ['OUTMSPRI', 'Primary Outcome Measure', 'Progression-free survival per investigator (RECIST 1.1)'],
    ['OUTMSSEC', 'Secondary Outcome Measure', 'Overall survival'],
    ['OUTMSSEC', 'Secondary Outcome Measure', 'Objective response rate (confirmed CR or PR)'],
    ['CRMDUR', 'Confirmed Response Minimum Duration', 'P28D'],
    ['SDMDUR', 'Stable Disease Minimum Duration', 'P35D'],
    ['SSTDTC', 'Study Start Date', iso(Math.min(...T.subjects.map((s) => s.consent)))],
    ['DCUTDTC', 'Data Cutoff Date', iso(DCO)],
    ['DCUTDESC', 'Data Cutoff Description', 'Final PFS analysis'],
    ['SDTIGVER', 'SDTM IG Version', '3.4'],
    ['SDTMVER', 'SDTM Version', '2.0'],
  ];
  const ts: Row[] = [];
  const grp = new Map<string, number>();
  for (const [cd, name, val] of tsList) {
    const n = (grp.get(cd) ?? 0) + 1;
    grp.set(cd, n);
    ts.push({ STUDYID, DOMAIN: 'TS', TSSEQ: n, TSPARMCD: cd, TSPARM: name, TSVAL: val });
  }
  for (const x of ta) link('TA', '', String(x.TAETORD), [{ file: '(protocol)', row: null, note: `Trial design: ${x.ARMCD} element ${x.ETCD}` }]);
  for (const x of te) link('TE', '', '', [{ file: '(protocol)', row: null, note: `Trial design element ${x.ETCD}` }]);
  for (const x of ts) link('TS', '', String(x.TSSEQ), [{ file: '(protocol)', row: null, note: `Trial summary parameter ${x.TSPARMCD}` }]);

  const strip = (rows: Row[]) => rows.map(({ _seq, ...rest }) => rest);
  const cols = (rows: Row[]) => Object.keys(rows[0]).filter((c) => c !== '_seq');
  const tables: Table[] = [
    ['dm', dm], ['suppdm', suppdm], ['ae', ae], ['suppae', suppae], ['cm', cm], ['mh', mh], ['ex', ex], ['lb', lb], ['vs', vs], ['eg', eg], ['rs', rs], ['tr', tr],
    ['ds', ds], ['dv', dv], ['dd', dd], ['ss', ss], ['sv', sv], ['se', se], ['ta', ta], ['te', te], ['ts', ts],
  ].map(([name, rows]) => ({ name: name as string, columns: cols(rows as Row[]), rows: strip(rows as Row[]) }));
  void C1D8;
  void VISIT;
  return { tables, lineage: { name: 'sdtm_raw_map', columns: ['DOMAIN', 'USUBJID', 'SEQ', 'RAW_FILE', 'RECORD_ID', 'NOTE'], rows: lineage } };
}
