/**
 * Raw layer: EDC / vendor-style exports rendered from the truth, then the
 * documented data problems are injected. Every injected change is written to
 * the answer key (answer-key/data_issues.csv). SDTM is built from the truth
 * (= the data after all queries were resolved), and lineage links SDTM records
 * back to these raw rows.
 */
import { CM_CATALOG, LAB, type LabTest } from './config.ts';
import { stream, type Rng } from './prng.ts';
import { MONTHS, edc, edcPartial, hhmm, iso, ymd, daysInMonth, type PartialDate } from './dates.ts';
import type { Table } from './csv.ts';
import type { Truth } from './truth.ts';
import type { TAe, TCm, TContact, TEcg, TExCbx, TExDoc, TLab, TMh, TScan, TSubject, TVitals } from './types.ts';

export type RawRow = Record<string, string>;

export interface RawFile {
  name: string;
  prefix: string;
  columns: string[];
  rows: RawRow[];
}

export interface Issue {
  file: string;
  row: RawRow | null;
  recordId?: string;
  column: string;
  type: string;
  problem: number | null;
  raw: string;
  resolution: string;
  corrected: string;
  subject: string;
  n?: number;
  /** filled after IDs are assigned */
  id?: string;
  refRow?: RawRow;
}

export interface RawResult {
  files: RawFile[];
  issues: Issue[];
  /** truth object → raw row it was rendered to */
  src: Map<object, RawRow>;
  subjRows: Map<TSubject, { enr: RawRow; dem: RawRow; bd: RawRow; rnd?: RawRow; eot?: RawRow; eos?: RawRow; dth?: RawRow }>;
  /** raw row → issue ids that touched it (after finalize) */
  rowIssues: Map<RawRow, string[]>;
  /** subjects whose rows were missing from the export and restored by query */
  restored: Map<string, string>;
  issuesTable: Table;
}

const title = (v: string) => v.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const edcVisit = (v: string) => (v === 'SCREENING' ? 'Screening' : v === 'SAFETY FOLLOW-UP' ? 'Safety Follow-up' : title(v));
const labVisit = (v: string) => {
  if (v === 'SCREENING') return 'SCRN';
  if (v === 'END OF TREATMENT') return 'EOT';
  if (v === 'SAFETY FOLLOW-UP') return 'SFU';
  if (v === 'UNSCHEDULED') return 'UNSCHED';
  const m = v.match(/^CYCLE (\d+) DAY (\d+)$/);
  return m ? `C${m[1]}D${m[2]}` : v;
};
const tumorVisitName = (v: string) => (v === 'SCREENING' ? 'Baseline' : title(v));
const ACTION_TEXT: Record<string, string> = {
  'DOSE NOT CHANGED': 'Dose not changed',
  'DOSE REDUCED': 'Dose reduced',
  'DRUG INTERRUPTED': 'Drug interrupted',
  'DRUG WITHDRAWN': 'Drug withdrawn',
  'NOT APPLICABLE': 'Not applicable',
  UNKNOWN: 'Unknown',
};
const OUTCOME_TEXT: Record<string, string> = {
  'RECOVERED/RESOLVED': 'Recovered/Resolved',
  'RECOVERING/RESOLVING': 'Recovering/Resolving',
  'NOT RECOVERED/NOT RESOLVED': 'Not recovered/Not resolved',
  'RECOVERED/RESOLVED WITH SEQUELAE': 'Recovered/Resolved with sequelae',
  FATAL: 'Fatal',
  UNKNOWN: 'Unknown',
};
export const NT_TEXT: Record<string, string> = { 'NON-CR/NON-PD': 'Non-CR/Non-PD', CR: 'CR', PD: 'PD', NE: 'NE' };
const pd = (p: PartialDate | null) => (p ? edcPartial(p) : '');

function file(name: string, prefix: string, columns: string[]): RawFile {
  return { name, prefix, columns: ['RECORD_ID', ...columns], rows: [] };
}

export function buildRaw(T: Truth): RawResult {
  const r = stream(T.seed, 'raw-issues');
  const src = new Map<object, RawRow>();
  const subjRows: RawResult['subjRows'] = new Map();
  const issues: Issue[] = [];
  const touched = new Set<RawRow>();
  const restored = new Map<string, string>();

  const F = {
    enr: file('enrollment.csv', 'ENR', ['SITE_ID', 'SUBJECT_ID', 'CONSENT_DATE', 'ICF_VERSION', 'ELIGIBLE', 'SCREEN_FAIL_REASON', 'SCREEN_FAIL_DATE']),
    dem: file('demographics.csv', 'DEM', ['SITE_ID', 'SUBJECT_ID', 'BIRTH_YEAR', 'AGE', 'SEX', 'RACE_WHITE', 'RACE_ASIAN', 'RACE_BLACK', 'RACE_AMIND', 'RACE_NHPI', 'RACE_OTHER', 'RACE_OTHER_SP', 'RACE_NOT_REPORTED', 'ETHNICITY', 'COUNTRY']),
    bd: file('baseline_disease.csv', 'BD', ['SITE_ID', 'SUBJECT_ID', 'HISTOLOGY', 'STAGE', 'DIAG_DATE', 'PDL1_TPS', 'PRIOR_LINES', 'PRIOR_IO', 'BRAIN_METS', 'SMOKING', 'ECOG_SCREEN']),
    rnd: file('randomization.csv', 'RND', ['SITE_ID', 'SUBJECT_ID', 'RAND_NO', 'RAND_DATE', 'STRAT_ECOG', 'STRAT_PRIOR_IO', 'ARM_ASSIGNED']),
    kit: file('kit_list.csv', 'KIT', ['KIT_NUMBER', 'KIT_CONTENT', 'LOT_NUMBER']),
    exs: file('ex_study_drug.csv', 'EXS', ['SITE_ID', 'SUBJECT_ID', 'CYCLE', 'KIT_NUMBER', 'DRUG_NAME_ENTERED', 'START_DATE', 'START_TIME', 'END_DATE', 'DOSE_MG', 'DOSE_CHANGE_REASON']),
    exd: file('ex_docetaxel.csv', 'EXD', ['SITE_ID', 'SUBJECT_ID', 'CYCLE', 'INFUSION_DATE', 'INFUSION_START_TIME', 'BSA', 'PLANNED_DOSE_MG_M2', 'ACTUAL_DOSE_MG', 'DOSE_CHANGE_REASON']),
    ae: file('ae.csv', 'AE', ['SITE_ID', 'SUBJECT_ID', 'AE_LINE', 'AE_TERM', 'AE_START', 'AE_END', 'AE_ONGOING', 'AE_GRADE', 'AE_SERIOUS', 'AE_SER_DEATH', 'AE_SER_LIFE_THREAT', 'AE_SER_HOSP', 'AE_SER_DISAB', 'AE_SER_CONG_ANOM', 'AE_SER_MED_IMPORTANT', 'AE_REL_CBX', 'AE_REL_DOC', 'AE_ACTION_CBX', 'AE_ACTION_DOC', 'AE_OUTCOME', 'CODED_PT', 'CODED_SOC']),
    cm: file('cm.csv', 'CM', ['SITE_ID', 'SUBJECT_ID', 'CM_LINE', 'CM_TERM', 'CM_INDICATION', 'CM_DOSE', 'CM_UNIT', 'CM_ROUTE', 'CM_FREQ', 'CM_START', 'CM_END', 'CM_ONGOING', 'CM_CATEGORY', 'CODED_NAME', 'CODED_ATC_CLASS']),
    mh: file('mh.csv', 'MH', ['SITE_ID', 'SUBJECT_ID', 'MH_LINE', 'MH_TERM', 'MH_START', 'MH_ONGOING', 'CODED_PT', 'CODED_SOC']),
    lb: file('labs.csv', 'LB', ['SITE_ID', 'SUBJECT_ID', 'VISIT_NAME', 'COLLECTION_DATE', 'COLLECTION_TIME', 'VENDOR_TEST_CODE', 'TEST_NAME', 'RESULT', 'UNIT', 'REF_LOW', 'REF_HIGH', 'RESULT_COMMENT', 'LAB_SOURCE', 'ACCESSION_NO']),
    vs: file('vitals.csv', 'VS', ['SITE_ID', 'SUBJECT_ID', 'VISIT_NAME', 'VS_DATE', 'VS_TIME', 'SYSBP', 'DIABP', 'PULSE', 'TEMP', 'TEMP_UNIT', 'WEIGHT', 'WEIGHT_UNIT', 'HEIGHT', 'HEIGHT_UNIT', 'ECOG']),
    eg: file('ecg.csv', 'ECG', ['SITE_ID', 'SUBJECT_ID', 'VISIT_NAME', 'ECG_DATE', 'ECG_TIME', 'QTCF_MS', 'HR_BPM', 'INTERPRETATION']),
    tu: file('tumor_assessment.csv', 'TUM', ['SITE_ID', 'SUBJECT_ID', 'VISIT_NAME', 'SCAN_DATE', 'SCAN_METHOD', 'TARGET_SLD_MM', 'NONTARGET_RESP', 'NEW_LESION', 'OVERALL_RESP']),
    eot: file('eot.csv', 'EOT', ['SITE_ID', 'SUBJECT_ID', 'EOT_DATE', 'LAST_DOSE_DATE', 'EOT_REASON']),
    eos: file('eos.csv', 'EOS', ['SITE_ID', 'SUBJECT_ID', 'EOS_DATE', 'EOS_REASON']),
    dth: file('death.csv', 'DTH', ['SITE_ID', 'SUBJECT_ID', 'DEATH_DATE', 'DEATH_CAUSE', 'DEATH_CAUSE_SPEC']),
    sf: file('survival_followup.csv', 'SFU', ['SITE_ID', 'SUBJECT_ID', 'CONTACT_DATE', 'CONTACT_METHOD', 'STATUS', 'NEW_THERAPY', 'NEW_THERAPY_NAME', 'NEW_THERAPY_START']),
    dv: file('deviations.csv', 'CTMS', ['DV_ID', 'SITE_ID', 'SUBJECT_ID', 'CATEGORY', 'DESCRIPTION', 'DV_DATE', 'SEVERITY']),
  };
  const ids = (s: TSubject) => ({ SITE_ID: s.site.siteId, SUBJECT_ID: s.subjid });
  const add = (f: RawFile, obj: object | null, row: RawRow) => {
    f.rows.push(row);
    if (obj) src.set(obj, row);
    return row;
  };

  const subjects = [...T.subjects].sort((a, b) => a.subjid.localeCompare(b.subjid));
  // sex coding habits by site (problem 4)
  const sexSites = new Map<string, 'word' | 'num'>();
  const gbrAus = T.sites.filter((x) => x.country.code === 'GBR' || x.country.code === 'AUS');
  sexSites.set(gbrAus[0].siteId, 'word');
  sexSites.set(gbrAus[gbrAus.length - 1].siteId, 'word');
  sexSites.set(T.sites.find((x) => x.country.code === 'KOR')!.siteId, 'num');

  const drugNames = ['CBX-417/Placebo', 'CBX-417/Placebo', 'CBX-417/Placebo', 'CBX417/PBO', 'Study drug', 'CBX-417 or placebo'];
  const siteDrugName = new Map(T.sites.map((x) => [x.siteId, r.pick(drugNames)]));

  for (const s of subjects) {
    const base = ids(s);
    const enr = add(F.enr, null, {
      ...base, CONSENT_DATE: edc(s.consent), ICF_VERSION: iso(s.consent) < '2022-11-01' ? '2.0' : '3.0', ELIGIBLE: s.screenFail ? 'N' : 'Y',
      SCREEN_FAIL_REASON: s.sfReason ?? '', SCREEN_FAIL_DATE: s.sfDate !== null ? edc(s.sfDate) : '',
    });
    const race = (x: string) => (s.races.includes(x) ? 'Y' : '');
    const dem = add(F.dem, null, {
      ...base, BIRTH_YEAR: String(s.birthYear), AGE: String(s.age), SEX: s.sex,
      RACE_WHITE: race('WHITE'), RACE_ASIAN: race('ASIAN'), RACE_BLACK: race('BLACK OR AFRICAN AMERICAN'), RACE_AMIND: race('AMERICAN INDIAN OR ALASKA NATIVE'),
      RACE_NHPI: race('NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER'), RACE_OTHER: race('OTHER'), RACE_OTHER_SP: s.raceOtherSp ?? '', RACE_NOT_REPORTED: race('NOT REPORTED'),
      ETHNICITY: s.ethnic === 'HISPANIC OR LATINO' ? 'Hispanic or Latino' : s.ethnic === 'NOT REPORTED' ? 'Not reported' : 'Not Hispanic or Latino',
      COUNTRY: s.site.country.name,
    });
    const bd = add(F.bd, null, {
      ...base, HISTOLOGY: s.histology, STAGE: s.stage, DIAG_DATE: edcPartial(s.diagDate), PDL1_TPS: s.pdl1 === 0 ? (r.bool(0.6) ? '<1' : '0') : String(s.pdl1),
      PRIOR_LINES: String(s.priorLines), PRIOR_IO: s.priorIO ? 'Y' : 'N', BRAIN_METS: s.brainMets ? 'Y' : 'N', SMOKING: title(s.smoking), ECOG_SCREEN: String(s.ecog),
    });
    const sr: { enr: RawRow; dem: RawRow; bd: RawRow; rnd?: RawRow; eot?: RawRow; eos?: RawRow; dth?: RawRow } = { enr, dem, bd };
    subjRows.set(s, sr);
    if (!s.screenFail) {
      sr.rnd = add(F.rnd, null, {
        ...base, RAND_NO: s.randNo!, RAND_DATE: iso(s.randDate!), STRAT_ECOG: String(s.stratEcog), STRAT_PRIOR_IO: s.stratIO ? 'Yes' : 'No',
        ARM_ASSIGNED: s.arm === 'CBX+DOC' ? 'CBX-417 + Docetaxel' : 'Placebo + Docetaxel',
      });
      const dn = siteDrugName.get(s.site.siteId)!;
      s.exCbx.forEach((x: TExCbx, i) =>
        add(F.exs, x, {
          ...base, CYCLE: String(x.cycle), KIT_NUMBER: x.kit, DRUG_NAME_ENTERED: dn, START_DATE: edc(x.start), START_TIME: i === 0 && x.time !== null ? hhmm(x.time) : '',
          END_DATE: edc(x.end), DOSE_MG: String(x.dose), DOSE_CHANGE_REASON: x.reason ?? '',
        }),
      );
      s.exDoc.forEach((x: TExDoc) =>
        add(F.exd, x, {
          ...base, CYCLE: String(x.cycle), INFUSION_DATE: edc(x.date), INFUSION_START_TIME: hhmm(x.time), BSA: x.bsa.toFixed(2), PLANNED_DOSE_MG_M2: String(x.level),
          ACTUAL_DOSE_MG: String(x.doseMg), DOSE_CHANGE_REASON: x.reason ?? '',
        }),
      );
      // AE page (includes one history item the site entered on the AE page)
      const aeItems: { start: number; ae?: TAe; mh?: TMh }[] = s.aes.map((a) => ({ start: a.start, ae: a }));
      for (const m of s.mhs) if (m.enteredOnAePage) aeItems.push({ start: s.consent - 62, mh: m });
      aeItems.sort((a, b) => a.start - b.start);
      aeItems.forEach((it, i) => {
        if (it.ae) {
          const a = it.ae;
          const yn = (b: boolean) => (b ? 'Y' : '');
          add(F.ae, a, {
            ...base, AE_LINE: String(i + 1), AE_TERM: a.verbatim, AE_START: a.startPartial ? edcPartial(a.startPartial) : edc(a.start),
            AE_END: a.end === null ? '' : a.endPartial ? edcPartial(a.endPartial) : edc(a.end), AE_ONGOING: a.end === null ? 'Y' : 'N', AE_GRADE: String(a.grade),
            AE_SERIOUS: a.serious ? 'Y' : 'N', AE_SER_DEATH: yn(a.sdth), AE_SER_LIFE_THREAT: yn(a.slife), AE_SER_HOSP: yn(a.shosp), AE_SER_DISAB: yn(a.sdisab),
            AE_SER_CONG_ANOM: yn(a.scong), AE_SER_MED_IMPORTANT: yn(a.smie),
            AE_REL_CBX: a.relCbx === null ? '' : a.relCbx === 'Y' ? 'Related' : 'Not related', AE_REL_DOC: a.relDoc === 'Y' ? 'Related' : 'Not related',
            AE_ACTION_CBX: ACTION_TEXT[a.acnCbx], AE_ACTION_DOC: ACTION_TEXT[a.acnDoc], AE_OUTCOME: OUTCOME_TEXT[a.outcome], CODED_PT: a.pt, CODED_SOC: a.soc,
          });
        } else {
          const m = it.mh!;
          const row = add(F.ae, m, {
            ...base, AE_LINE: String(i + 1), AE_TERM: m.verbatim, AE_START: edc(s.consent - 62), AE_END: '', AE_ONGOING: 'Y', AE_GRADE: '1', AE_SERIOUS: 'N',
            AE_SER_DEATH: '', AE_SER_LIFE_THREAT: '', AE_SER_HOSP: '', AE_SER_DISAB: '', AE_SER_CONG_ANOM: '', AE_SER_MED_IMPORTANT: '',
            AE_REL_CBX: 'Not related', AE_REL_DOC: 'Not related', AE_ACTION_CBX: 'Not applicable', AE_ACTION_DOC: 'Not applicable', AE_OUTCOME: 'Not recovered/Not resolved',
            CODED_PT: m.pt, CODED_SOC: m.soc,
          });
          touched.add(row);
          issues.push({
            file: 'ae.csv', row, column: 'AE_START', type: 'AE START BEFORE INFORMED CONSENT', problem: 7, raw: row.AE_START, subject: s.subjid,
            corrected: `(record moved to MH; MHSTDTC=${iso(s.consent - 62)})`,
            resolution: 'Query: condition existed before informed consent (medical history entered on the AE page). Removed from AE; mapped to SDTM MH.',
          });
        }
      });
      s.cms.forEach((c: TCm, i) =>
        add(F.cm, c, {
          ...base, CM_LINE: String(i + 1), CM_TERM: c.verbatim, CM_INDICATION: c.indication, CM_DOSE: c.dose === null ? '' : String(c.dose), CM_UNIT: c.unit ?? '',
          CM_ROUTE: c.route, CM_FREQ: c.freq ?? '', CM_START: pd(c.start), CM_END: pd(c.end), CM_ONGOING: c.ongoing ? 'Y' : 'N', CM_CATEGORY: c.category,
          CODED_NAME: c.name, CODED_ATC_CLASS: CM_CATALOG[c.name].atc,
        }),
      );
      s.mhs.filter((m) => !m.enteredOnAePage).forEach((m: TMh, i) =>
        add(F.mh, m, { ...base, MH_LINE: String(i + 1), MH_TERM: m.verbatim, MH_START: edcPartial(m.start), MH_ONGOING: m.ongoing ? 'Y' : 'N', CODED_PT: m.pt, CODED_SOC: m.soc }),
      );
    }
    for (const l of s.labs) add(F.lb, l, labRow(s, l));
    for (const v of s.vitals) add(F.vs, v, vitalsRow(s, v));
    if (!s.screenFail) {
      for (const e of s.ecgs) add(F.eg, e, { ...base, VISIT_NAME: edcVisit(e.visitName), ECG_DATE: edc(e.date), ECG_TIME: hhmm(e.time), QTCF_MS: String(e.qtcf), HR_BPM: String(e.hr), INTERPRETATION: e.interp } as RawRow);
      for (const sc of s.scans) add(F.tu, sc, scanRow(s, sc));
      if (s.eotReason !== null || s.neverTreatedReason !== null) {
        const ntText: Record<string, string> = {
          'WITHDRAWAL BY SUBJECT': 'Withdrew consent before first dose',
          'PHYSICIAN DECISION': 'Clinical deterioration before first dose - investigator decision',
          'RANDOMIZED BY MISTAKE WITHOUT STUDY TREATMENT': 'Randomized in error (EGFR mutation reported after randomization) - never dosed',
        };
        const eotDate = s.eotDate ?? (s.eotReason === 'DEATH' ? s.deathDate : null) ?? s.withdrawalDate ?? s.lastDose ?? s.randDate! + 3;
        sr.eot = add(F.eot, null, {
          ...base, EOT_DATE: edc(eotDate), LAST_DOSE_DATE: s.lastDose !== null ? edc(s.lastDose) : '',
          EOT_REASON: s.treated ? s.eotReasonText! : ntText[s.neverTreatedReason!],
        });
      }
      if (s.eosReason !== null) {
        const t: Record<string, string> = { DEATH: 'Death', 'WITHDRAWAL BY SUBJECT': 'Withdrawal of consent', 'LOST TO FOLLOW-UP': 'Lost to follow-up' };
        sr.eos = add(F.eos, null, { ...base, EOS_DATE: edc(s.eosDate!), EOS_REASON: t[s.eosReason] });
      }
      if (s.deathDate !== null) {
        const fatal = s.aes.find((a) => a.grade === 5);
        const spec = s.deathCause === 'Adverse event' ? (fatal?.pt ?? '') : s.deathCause === 'Other' ? r.pick(['Sudden death', 'Myocardial infarction', 'Stroke', 'Fall with head injury']) : '';
        sr.dth = add(F.dth, null, { ...base, DEATH_DATE: edc(s.deathDate), DEATH_CAUSE: s.deathCause ?? 'Unknown', DEATH_CAUSE_SPEC: spec });
      }
      for (const c of s.contacts) add(F.sf, c, contactRow(s, c, r));
    }
  }
  // kit list
  for (const k of T.kits)
    add(F.kit, k, { KIT_NUMBER: k.kit, KIT_CONTENT: k.content === 'CBX-417' ? 'CBX-417 50 mg tablets' : 'Placebo tablets', LOT_NUMBER: k.content === 'CBX-417' ? `CBX-L${2201 + (Number(k.kit) % 4)}` : `PBO-L${2201 + (Number(k.kit) % 3)}` });
  // deviations (CTMS)
  const dvs = subjects.filter((s) => !s.screenFail).flatMap((s) => s.dvs.map((d) => ({ s, d })));
  dvs.sort((a, b) => a.d.date - b.d.date || a.s.subjid.localeCompare(b.s.subjid));
  dvs.forEach(({ s, d }, i) => add(F.dv, d, { DV_ID: `PD-${String(i + 1).padStart(4, '0')}`, ...ids(s), CATEGORY: d.category, DESCRIPTION: d.description, DV_DATE: iso(d.date), SEVERITY: d.severity }));

  injectIssues(T, F, src, subjRows, issues, touched, restored, r, sexSites);

  // assign RECORD_IDs, then resolve answer key references
  const files = Object.values(F);
  for (const f of files) f.rows.forEach((row, i) => (row.RECORD_ID = `${f.prefix}-${String(i + 1).padStart(6, '0')}`));
  const order = (x: Issue) => `${String(x.problem ?? 99).padStart(2, '0')}|${x.file}|${x.row?.RECORD_ID ?? x.recordId ?? ''}|${x.column}`;
  issues.sort((a, b) => order(a).localeCompare(order(b)));
  const rowIssues = new Map<RawRow, string[]>();
  issues.forEach((x, i) => {
    x.id = `DI-${String(i + 1).padStart(4, '0')}`;
    if (x.row) {
      x.recordId = x.row.RECORD_ID;
      if (!rowIssues.has(x.row)) rowIssues.set(x.row, []);
      rowIssues.get(x.row)!.push(x.id);
    }
    if (x.refRow) x.raw = x.raw.replace('{REF}', x.refRow.RECORD_ID);
  });
  for (const [k, v] of restored) restored.set(k, v.replace(/\{ISSUE:([^}]+)\}/g, (_, tag) => issues.find((x) => x.subject === tag.split('|')[0] && x.file === tag.split('|')[1])?.id ?? ''));
  const issuesTable: Table = {
    name: 'data_issues',
    columns: ['ISSUE_ID', 'FILE', 'RECORD_ID', 'COLUMN', 'ISSUE_TYPE', 'RAW_VALUE', 'RESOLUTION', 'CORRECTED_VALUE', 'PROBLEM_NO', 'SUBJECT_ID', 'N_RECORDS'],
    rows: issues.map((x) => ({
      ISSUE_ID: x.id!, FILE: x.file, RECORD_ID: x.recordId ?? '', COLUMN: x.column, ISSUE_TYPE: x.type, RAW_VALUE: x.raw, RESOLUTION: x.resolution,
      CORRECTED_VALUE: x.corrected, PROBLEM_NO: x.problem === null ? '' : String(x.problem), SUBJECT_ID: x.subject, N_RECORDS: String(x.n ?? 1),
    })),
  };
  return { files, issues, src, subjRows, rowIssues, restored, issuesTable };
}

function labRow(s: TSubject, l: TLab): RawRow {
  const t: LabTest = LAB[l.code];
  return {
    SITE_ID: s.site.siteId, SUBJECT_ID: s.subjid, VISIT_NAME: labVisit(l.visitName), COLLECTION_DATE: iso(l.date), COLLECTION_TIME: hhmm(l.time),
    VENDOR_TEST_CODE: l.local ? t.local.code : t.vendorCode, TEST_NAME: l.local ? t.local.name : t.vendorName,
    RESULT: l.notDone ? '' : l.orig, UNIT: l.origUnit, REF_LOW: l.origLo, REF_HIGH: l.origHi,
    RESULT_COMMENT: l.notDone ? (l.code === 'HGB' || l.code === 'PLAT' ? 'SAMPLE CLOTTED' : 'SAMPLE HEMOLYZED') : '', LAB_SOURCE: l.local ? 'LOCAL' : 'CENTRAL', ACCESSION_NO: l.accession,
  };
}

function vitalsRow(s: TSubject, v: TVitals): RawRow {
  return {
    SITE_ID: s.site.siteId, SUBJECT_ID: s.subjid, VISIT_NAME: edcVisit(v.visitName), VS_DATE: edc(v.date), VS_TIME: hhmm(v.time),
    SYSBP: String(v.sysbp), DIABP: String(v.diabp), PULSE: String(v.pulse), TEMP: v.temp.toFixed(1), TEMP_UNIT: 'C', WEIGHT: v.weight.toFixed(1), WEIGHT_UNIT: 'kg',
    HEIGHT: v.height !== null ? String(v.height) : '', HEIGHT_UNIT: v.height !== null ? 'cm' : '', ECOG: v.ecog !== null ? String(v.ecog) : '',
  };
}

function scanRow(s: TSubject, sc: TScan): RawRow {
  return {
    SITE_ID: s.site.siteId, SUBJECT_ID: s.subjid, VISIT_NAME: tumorVisitName(sc.visitName), SCAN_DATE: edc(sc.date), SCAN_METHOD: sc.method === 'CT SCAN' ? 'CT' : 'MRI',
    TARGET_SLD_MM: sc.sld === null ? '' : String(sc.sld), NONTARGET_RESP: sc.nt ? NT_TEXT[sc.nt] : '', NEW_LESION: sc.newLesion ?? '', OVERALL_RESP: sc.resp ?? '',
  };
}

function contactRow(s: TSubject, c: TContact, r: Rng): RawRow {
  return {
    SITE_ID: s.site.siteId, SUBJECT_ID: s.subjid, CONTACT_DATE: edc(c.date), CONTACT_METHOD: r.bool(0.85) ? 'Telephone' : 'Clinic visit', STATUS: c.status,
    NEW_THERAPY: c.status === 'Alive' ? c.newTherapy : '', NEW_THERAPY_NAME: c.therapyName ? title(c.therapyName) : '', NEW_THERAPY_START: c.therapyStart !== null ? edc(c.therapyStart) : '',
  };
}

/** An impossible calendar date for the same month (or an impossible year). */
function impossibleDate(day: number, r: Rng, forceYear = false): string {
  const { y, m, d } = ymd(day);
  if (!forceYear && m === 2) return `${r.bool(0.5) ? 30 : 31} FEB ${y}`;
  if (!forceYear && daysInMonth(y, m) === 30) return `31 ${MONTHS[m - 1]} ${y}`;
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y + 180}`;
}

function injectIssues(
  T: Truth,
  F: Record<string, RawFile>,
  src: Map<object, RawRow>,
  subjRows: RawResult['subjRows'],
  issues: Issue[],
  touched: Set<RawRow>,
  restored: Map<string, string>,
  r: Rng,
  sexSites: Map<string, 'word' | 'num'>,
) {
  const subj = new Map(T.subjects.map((s) => [s.subjid, s]));
  const rnd = T.subjects.filter((s) => !s.screenFail);
  const special = new Set(Object.values(T.special).flat().map((x) => x.split('|')[0]));
  const plain = rnd.filter((s) => s.treated && !special.has(s.subjid));
  const push = (x: Issue) => {
    issues.push(x);
    if (x.row) touched.add(x.row);
  };
  const free = (rows: RawRow[]) => rows.filter((x) => !touched.has(x));
  const set = (f: RawFile, row: RawRow, col: string, value: string, type: string, problem: number, resolution: string, corrected?: string) => {
    const orig = row[col];
    const subject = col === 'SUBJECT_ID' ? (corrected ?? orig) : (row.SUBJECT_ID ?? '');
    row[col] = value;
    push({ file: f.name, row, column: col, type, problem, raw: value, corrected: corrected ?? orig, resolution, subject });
  };
  // subjects whose rows will be removed (problems 9 and 10) are reserved first
  const omit = r.pick(plain.filter((s) => s.exCbx.length >= 3));
  const gap = r.sample(plain.filter((x) => x.subjid !== omit.subjid), 2);
  for (const row of [...F.exs.rows, ...F.exd.rows]) if (row.SUBJECT_ID === omit.subjid) touched.add(row);
  for (const s of gap) touched.add(subjRows.get(s)!.rnd!);

  // (1) exact duplicate rows: AE (double export) and labs (vendor re-transmission)
  for (const row of r.sample(free(F.ae.rows), 5)) {
    const copy = { ...row };
    touched.add(row);
    F.ae.rows.splice(F.ae.rows.indexOf(row) + 1, 0, copy);
    push({ file: F.ae.name, row: copy, refRow: row, column: '(all)', type: 'EXACT DUPLICATE ROW', problem: 1, raw: 'Duplicate of {REF} (identical except RECORD_ID)', corrected: '(delete row)', resolution: 'Duplicate created by a double EDC export; delete before mapping (not in SDTM).', subject: row.SUBJECT_ID });
  }
  for (const row of r.sample(free(F.lb.rows.filter((x) => x.LAB_SOURCE === 'CENTRAL' && x.RESULT !== '')), 12)) {
    const copy = { ...row };
    touched.add(row);
    F.lb.rows.push(copy);
    push({ file: F.lb.name, row: copy, refRow: row, column: '(all)', type: 'EXACT DUPLICATE ROW', problem: 1, raw: 'Duplicate of {REF} (identical except RECORD_ID)', corrected: '(delete row)', resolution: 'Vendor re-transmitted the result in a later transfer; keep one record per accession/test.', subject: row.SUBJECT_ID });
  }

  // (2) impossible dates
  const impo = (f: RawFile, rows: RawRow[], col: string, n: number, forceYear: boolean, get: (row: RawRow) => number) => {
    for (const row of r.sample(free(rows), n))
      set(f, row, col, impossibleDate(get(row), r, forceYear), 'IMPOSSIBLE DATE', 2, forceYear ? 'Query: year keyed incorrectly; corrected by site.' : 'Query: day/month keyed incorrectly; corrected by site from source.');
  };
  const aeFull = F.ae.rows.filter((x) => /^\d\d (FEB|APR|JUN|SEP|NOV) \d{4}$/.test(x.AE_START));
  const aeObj = new Map<RawRow, TAe>();
  for (const s of rnd) for (const a of s.aes) aeObj.set(src.get(a)!, a);
  impo(F.ae, aeFull.filter((x) => aeObj.has(x)), 'AE_START', 3, false, (row) => aeObj.get(row)!.start);
  const vsObj = new Map<RawRow, TVitals>();
  for (const s of T.subjects) for (const v of s.vitals) vsObj.set(src.get(v)!, v);
  impo(F.vs, F.vs.rows.filter((x) => vsObj.has(x) && x.VISIT_NAME !== 'Screening'), 'VS_DATE', 2, true, (row) => vsObj.get(row)!.date);
  const cmObj = new Map<RawRow, TCm>();
  for (const s of rnd) for (const c of s.cms) cmObj.set(src.get(c)!, c);
  impo(F.cm, F.cm.rows.filter((x) => cmObj.has(x) && /^\d\d (FEB|APR|JUN|SEP|NOV) \d{4}$/.test(x.CM_START)), 'CM_START', 1, false, (row) => {
    const p = cmObj.get(row)!.start;
    return Math.round(Date.UTC(p.y, p.m! - 1, p.d!) / 86400000);
  });
  const exdObj = new Map<RawRow, TExDoc>();
  for (const s of rnd) for (const x of s.exDoc) exdObj.set(src.get(x)!, x);
  impo(F.exd, F.exd.rows.filter((x) => exdObj.has(x) && /(FEB|APR|JUN|SEP|NOV)/.test(x.INFUSION_DATE)), 'INFUSION_DATE', 1, false, (row) => exdObj.get(row)!.date);
  const tuObj = new Map<RawRow, TScan>();
  for (const s of rnd) for (const x of s.scans) tuObj.set(src.get(x)!, x);
  impo(F.tu, F.tu.rows.filter((x) => tuObj.has(x) && /(FEB|APR|JUN|SEP|NOV)/.test(x.SCAN_DATE) && x.VISIT_NAME !== 'Baseline'), 'SCAN_DATE', 1, false, (row) => tuObj.get(row)!.date);

  // (3) missing units (central labs)
  for (const row of r.sample(free(F.lb.rows.filter((x) => x.LAB_SOURCE === 'CENTRAL' && x.RESULT !== '')), 10))
    set(F.lb, row, 'UNIT', '', 'MISSING UNIT', 3, 'Unit confirmed with the central laboratory (test code defines the reporting unit).');

  // (4) inconsistent sex coding
  for (const s of T.subjects) {
    const row = subjRows.get(s)!.dem;
    const habit = sexSites.get(s.site.siteId);
    let v: string | null = null;
    if (habit === 'word') v = s.sex === 'M' ? 'Male' : 'Female';
    else if (habit === 'num') v = s.sex === 'M' ? '1' : '2';
    if (v) set(F.dem, row, 'SEX', v, 'INCONSISTENT CODING', 4, habit === 'num' ? 'Site CRF completion guideline used 1 = Male, 2 = Female; recode to CDISC SEX.' : 'Recode to CDISC SEX (M/F).', s.sex);
  }
  const variants: Record<'M' | 'F', string[]> = { M: ['male', 'MALE', 'M '], F: ['f ', 'female', 'F '] };
  for (const s of r.sample(T.subjects.filter((x) => !sexSites.has(x.site.siteId)), 7)) {
    const row = subjRows.get(s)!.dem;
    set(F.dem, row, 'SEX', r.pick(variants[s.sex]), 'INCONSISTENT CODING', 4, 'Trim whitespace / standardize case and recode to CDISC SEX (M/F).', s.sex);
  }

  // (5) unknown / misspelled treatment
  const kitSet = new Set(T.kits.map((k) => k.kit));
  const mutateKit = (k: string, i: number) => {
    const c = k.split('');
    if (i === 0) [c[1], c[2]] = [c[2], c[1]];
    if (i === 1) return k.slice(0, 5);
    if (i === 2) return k.slice(0, 3) + 'O' + k.slice(4);
    if (i === 3) return k + String(r.int(0, 9));
    return c.join('');
  };
  let ki = 0;
  for (const row of r.sample(free(F.exs.rows), 12)) {
    if (ki >= 4) break;
    const bad = mutateKit(row.KIT_NUMBER, ki);
    if (bad === row.KIT_NUMBER || kitSet.has(bad)) continue;
    set(F.exs, row, 'KIT_NUMBER', bad, 'KIT NUMBER NOT IN KIT LIST', 5, 'Query: kit number mis-keyed; corrected from the IxRS dispensing log (actual treatment follows the kit list).');
    ki++;
  }
  for (const row of r.sample(free(F.exs.rows), 3))
    set(F.exs, row, 'DRUG_NAME_ENTERED', 'PLB', 'UNKNOWN/MISSPELLED TREATMENT TEXT', 5, 'Free-text drug name is not used for mapping (blinded study; actual treatment comes from kit list). Site retrained.', 'CBX-417/Placebo');
  for (const row of r.sample(free(F.exs.rows), 2))
    set(F.exs, row, 'DRUG_NAME_ENTERED', 'CBX-471', 'UNKNOWN/MISSPELLED TREATMENT TEXT', 5, 'Misspelled free-text drug name; ignored for mapping (actual treatment comes from kit list).', 'CBX-417/Placebo');

  // (6) lab units by source: local laboratories report conventional units (pattern rows) + mislabelled units
  const localGroups = new Map<string, RawRow[]>();
  for (const row of F.lb.rows)
    if (row.LAB_SOURCE === 'LOCAL') {
      const t = Object.values(LAB).find((x) => x.local.code === row.VENDOR_TEST_CODE)!;
      if (row.UNIT === t.unit) continue;
      const k = `${row.SITE_ID}|${row.VENDOR_TEST_CODE}|${row.UNIT}`;
      if (!localGroups.has(k)) localGroups.set(k, []);
      localGroups.get(k)!.push(row);
    }
  for (const [k, rows] of [...localGroups.entries()].sort()) {
    const [site, code, unit] = k.split('|');
    const t = Object.values(LAB).find((x) => x.local.code === code)!;
    push({
      file: F.lb.name, row: null, recordId: 'MULTIPLE', column: 'RESULT;UNIT;REF_LOW;REF_HIGH', type: 'NON-STANDARD UNIT (LOCAL LAB)', problem: 6,
      raw: `SITE_ID=${site}, VENDOR_TEST_CODE=${code}, UNIT=${unit}`, subject: '', n: rows.length,
      corrected: t.local.factor === 1 ? `${t.unit} (numerically identical: 1 ${unit} = 1 ${t.unit})` : `${t.unit} = result x ${t.local.factor}`,
      resolution: `Local laboratory reports ${t.code} in ${unit}; keep original in LBORRES/LBORRESU, convert to ${t.unit} in LBSTRESN/LBSTRESU (reference range converted the same way).`,
    });
  }
  const hgbLocal = free(F.lb.rows.filter((x) => x.VENDOR_TEST_CODE === 'L-HGB' && x.UNIT === 'g/dL'));
  for (const row of r.sample(hgbLocal, Math.min(3, hgbLocal.length)))
    set(F.lb, row, 'UNIT', 'g/L', 'UNIT MISLABELED', 6, 'Result magnitude (e.g., 10.8) is only plausible in g/dL; local lab confirmed the unit.', 'g/dL');

  // (7) AE start date before informed consent (year keyed incorrectly)
  const onAe = rnd.flatMap((s) => s.aes.filter((a) => a.phase === 'on' && !a.startPartial && a.grade < 5).map((a) => ({ s, a })));
  for (const { s, a } of r.sample(onAe.filter(({ a }) => !touched.has(src.get(a)!)), 3)) {
    const row = src.get(a)!;
    const { y, m, d } = ymd(a.start);
    set(F.ae, row, 'AE_START', `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y - 1}`, 'AE START DATE BEFORE INFORMED CONSENT', 7, `Query: wrong year entered (informed consent ${edc(s.consent)}); corrected by site.`, edc(a.start));
  }

  // (8) end date before start date (AE, CM)
  const aeEnd = rnd.flatMap((s) => s.aes.filter((a) => a.end !== null && !a.endPartial && !a.startPartial && a.end - a.start >= 5).map((a) => a));
  for (const a of r.sample(aeEnd.filter((x) => !touched.has(src.get(x)!)), 4)) {
    const row = src.get(a)!;
    const { y, m, d } = ymd(a.end!);
    const bad = a.end! - a.start < 40 ? `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y - 1}` : edc(a.start - r.int(3, 20));
    set(F.ae, row, 'AE_END', bad, 'END DATE BEFORE START DATE', 8, 'Query: end date keyed incorrectly; corrected by site.', edc(a.end!));
  }
  const cmEnd = rnd.flatMap((s) => s.cms.filter((c) => c.category === 'CONCOMITANT' && c.end && c.end.d !== undefined && c.start.d !== undefined && c.start.y >= ymd(s.consent).y));
  for (const c of r.sample(cmEnd.filter((x) => !touched.has(src.get(x)!)), 3)) {
    const row = src.get(c)!;
    const e = c.end!;
    set(F.cm, row, 'CM_END', `${String(e.d).padStart(2, '0')} ${MONTHS[e.m! - 1]} ${e.y - 1}`, 'END DATE BEFORE START DATE', 8, 'Query: end year keyed incorrectly; corrected by site.', edcPartial(e));
  }

  // (9) randomized subject without treatment records (data-entry omission, restored by query)
  const nEx = F.exs.rows.filter((x) => x.SUBJECT_ID === omit.subjid).length;
  const nEd = F.exd.rows.filter((x) => x.SUBJECT_ID === omit.subjid).length;
  F.exs.rows = F.exs.rows.filter((x) => x.SUBJECT_ID !== omit.subjid);
  F.exd.rows = F.exd.rows.filter((x) => x.SUBJECT_ID !== omit.subjid);
  push({ file: F.exs.name, row: null, recordId: '(missing)', column: '(all)', type: 'RANDOMIZED WITHOUT TREATMENT RECORDS', problem: 9, raw: '(no records for subject)', corrected: `${nEx} dosing records`, subject: omit.subjid, resolution: 'Query: dosing pages not entered before the data transfer (labs, AEs and visits show the subject was treated). Site entered the pages; SDTM EX built from the resolved data.' });
  push({ file: F.exd.name, row: null, recordId: '(missing)', column: '(all)', type: 'RANDOMIZED WITHOUT TREATMENT RECORDS', problem: 9, raw: '(no records for subject)', corrected: `${nEd} infusion records`, subject: omit.subjid, resolution: 'Query: infusion pages not entered before the data transfer; entered by site after query.' });
  restored.set(`${omit.subjid}|EX`, `Record not in raw export (pages entered after transfer; see answer key {ISSUE:${omit.subjid}|ex_study_drug.csv})`);
  for (const s of T.special.neverTreated.map((id) => subj.get(id)!)) {
    push({ file: F.eot.name, row: subjRows.get(s)!.eot!, column: 'LAST_DOSE_DATE', type: 'TRUE FINDING (NOT AN ERROR): RANDOMIZED, NEVER TREATED', problem: 9, raw: '', corrected: '', subject: s.subjid, resolution: `Confirmed by site: randomized but never dosed (${s.neverTreatedReason}). Keep in ITT; SAFFL = N; ACTARMCD null with ARMNRS = ASSIGNED, NOT TREATED.` });
  }

  // (10) treatment records without a randomization row (IxRS transfer gap)
  for (const s of gap) {
    const row = subjRows.get(s)!.rnd!;
    F.rnd.rows = F.rnd.rows.filter((x) => x !== row);
    push({ file: F.rnd.name, row: null, recordId: '(missing)', column: '(all)', type: 'TREATED WITHOUT RANDOMIZATION RECORD', problem: 10, raw: '(no record for subject)', subject: s.subjid, corrected: `RAND_NO=${s.randNo}; RAND_DATE=${iso(s.randDate!)}; STRAT_ECOG=${s.stratEcog}; STRAT_PRIOR_IO=${s.stratIO ? 'Yes' : 'No'}; ARM_ASSIGNED=${row.ARM_ASSIGNED}`, resolution: 'IxRS transfer gap: record missing from the export; IxRS vendor re-sent the record (used for SDTM DM/DS).' });
    restored.set(`${s.subjid}|RND`, `IxRS record missing from export; restored from IxRS re-transfer (see answer key {ISSUE:${s.subjid}|randomization.csv})`);
    subjRows.get(s)!.rnd = undefined;
  }

  // (11) duplicate subject identifiers
  const sfs = T.subjects.filter((s) => s.screenFail && !sexSites.has(s.site.siteId));
  let dupDone = false;
  for (const sf of sfs) {
    const n = sf.subjid.split('-')[1];
    const other = rnd.find((s) => s.site.siteId !== sf.site.siteId && s.subjid.endsWith(`-${n}`) && Math.abs(Number(s.site.siteId) - Number(sf.site.siteId)) === 1);
    if (!other) continue;
    const rows: [RawFile, RawRow][] = [[F.enr, subjRows.get(sf)!.enr], [F.dem, subjRows.get(sf)!.dem], [F.bd, subjRows.get(sf)!.bd]];
    for (const v of sf.vitals) rows.push([F.vs, src.get(v)!]);
    for (const [f, row] of rows) set(f, row, 'SUBJECT_ID', other.subjid, 'DUPLICATE SUBJECT ID (SAME ID AT TWO SITES)', 11, `Site ${sf.site.siteId} keyed another site's prefix; the subject is a screen failure at site ${sf.site.siteId}. Corrected by site (lab vendor file already carries the correct ID).`, sf.subjid);
    dupDone = true;
    break;
  }
  if (!dupDone) throw new Error('no candidate for duplicate subject ID');
  const accs = new Map<string, RawRow[]>();
  for (const row of F.lb.rows)
    if (row.VISIT_NAME === 'C1D8' && row.LAB_SOURCE === 'CENTRAL') {
      if (!accs.has(row.ACCESSION_NO)) accs.set(row.ACCESSION_NO, []);
      accs.get(row.ACCESSION_NO)!.push(row);
    }
  const allIds = new Set(T.subjects.map((s) => s.subjid));
  for (const [, rows] of [...accs.entries()].sort()) {
    const id = rows[0].SUBJECT_ID;
    const num = id.split('-')[1];
    const swapped = `${id.split('-')[0]}-${num[0]}${num[1]}${num[3]}${num[2]}`;
    if (num[2] === num[3] || allIds.has(swapped) || rows.some((x) => touched.has(x)) || special.has(id)) continue;
    for (const row of rows) set(F.lb, row, 'SUBJECT_ID', swapped, 'TRANSPOSED SUBJECT ID', 11, 'Requisition form keyed with transposed digits; matched to the subject by accession number, site and visit date; vendor corrected.', id);
    break;
  }

  // (12) outliers: data errors + genuine extreme values that must be retained
  const vsRows = free(F.vs.rows.filter((x) => vsObj.has(x) && x.VISIT_NAME !== 'Screening' && Number(x.WEIGHT) >= 65 && Number(x.WEIGHT) < 75 && subj.get(x.SUBJECT_ID)?.site.imperial === false));
  const w = r.pick(vsRows);
  set(F.vs, w, 'WEIGHT', (Number(w.WEIGHT) * 10).toFixed(0), 'OUTLIER (DATA ERROR)', 12, 'Query: decimal point omitted (weight in kg keyed without the decimal); corrected by site.', w.WEIGHT);
  const hRow = r.pick(free(F.vs.rows.filter((x) => x.VISIT_NAME === 'Screening' && x.HEIGHT !== '' && Number(x.HEIGHT) >= 170 && Number(x.HEIGHT) < 180 && subj.get(x.SUBJECT_ID)?.screenFail === false)));
  set(F.vs, hRow, 'HEIGHT', hRow.HEIGHT.slice(0, 2), 'OUTLIER (DATA ERROR)', 12, 'Query: last digit of height omitted; corrected by site.', hRow.HEIGHT);
  const altRow = r.pick(free(F.lb.rows.filter((x) => x.VENDOR_TEST_CODE === 'CH010' && Number(x.RESULT) >= 100 && Number(x.RESULT) < 200)));
  set(F.lb, altRow, 'RESULT', String(Number(altRow.RESULT) * 100), 'OUTLIER (DATA ERROR)', 12, 'Vendor confirmed a decimal-shift transcription error (value x100); corrected in the next transfer.', altRow.RESULT);
  for (const g of T.special.genuine) {
    const [dom, id, code, date, time] = g.split('|');
    const s = subj.get(id)!;
    if (dom === 'LB') {
      const l = s.labs.find((x) => x.code === code && x.date === Number(date) && x.time === Number(time))!;
      const row = src.get(l)!;
      push({ file: F.lb.name, row, column: 'RESULT', type: 'GENUINE EXTREME VALUE (RETAIN)', problem: 12, raw: row.RESULT, corrected: row.RESULT, subject: id, resolution: 'Source-verified and consistent with a concurrent grade 4 AE; not an error. Do not delete or cap.' });
    } else {
      const v = s.vitals.find((x) => x.date === Number(date) && x.time === Number(time))!;
      const row = src.get(v)!;
      push({ file: F.vs.name, row, column: code, type: 'GENUINE EXTREME VALUE (RETAIN)', problem: 12, raw: row[code], corrected: row[code], subject: id, resolution: code === 'WEIGHT' ? 'Source-verified body weight (BMI > 50); not an error.' : 'Source-verified; consistent with the grade 3 hypertension AE. Do not delete.' });
    }
  }

  // (13) missing baseline assessments
  for (const s of rnd) {
    for (const l of s.labs.filter((x) => x.notDone)) {
      const row = src.get(l)!;
      push({ file: F.lb.name, row, column: 'RESULT', type: 'MISSING BASELINE ASSESSMENT', problem: 13, raw: `(blank; ${row.RESULT_COMMENT})`, corrected: '(none - test not done)', subject: s.subjid, resolution: 'Confirmed not done (sample unusable). SDTM keeps the record with LBSTAT = NOT DONE; ADaM baseline falls to the next pre-dose value if one exists.' });
    }
    if (s.noBaselineScan)
      push({ file: F.tu.name, row: null, recordId: '(missing)', column: '(all)', type: 'MISSING BASELINE ASSESSMENT', problem: 13, raw: '(no baseline tumor assessment)', corrected: '(none - not performed)', subject: s.subjid, resolution: 'Confirmed not performed (major protocol deviation). No correction; subject is not efficacy-evaluable and PFS is censored at randomization per SAP (CNSR = 2).' });
  }

  // (14) partial dates: AE individually; MH / CM / diagnosis date as documented patterns
  for (const s of rnd)
    for (const a of s.aes) {
      const row = src.get(a)!;
      if (a.startPartial) push({ file: F.ae.name, row, column: 'AE_START', type: 'PARTIAL DATE', problem: 14, raw: row.AE_START, corrected: isoP(a.startPartial), subject: s.subjid, resolution: 'Keep as ISO 8601 partial date in SDTM (no imputation); ADaM imputes ASTDT per SAP and sets ASTDTF.' });
      if (a.endPartial) push({ file: F.ae.name, row, column: 'AE_END', type: 'PARTIAL DATE', problem: 14, raw: row.AE_END, corrected: isoP(a.endPartial), subject: s.subjid, resolution: 'Keep as ISO 8601 partial date in SDTM; ADaM imputes AENDT (last day of month) and sets AENDTF.' });
    }
  const pat = (f: RawFile, col: string, label: string) => {
    const rows = f.rows.filter((x) => /^UN /.test(x[col] ?? ''));
    const nYear = rows.filter((x) => / UNK /.test(x[col])).length;
    push({ file: f.name, row: null, recordId: 'MULTIPLE', column: col, type: 'PARTIAL DATE', problem: 14, raw: `"UN MMM YYYY" (${rows.length - nYear}) and "UN UNK YYYY" (${nYear})`, corrected: 'YYYY-MM / YYYY', subject: '', n: rows.length, resolution: `${label}: convert to ISO 8601 with reduced precision (no imputation in SDTM).` });
  };
  pat(F.mh, 'MH_START', 'Medical history start dates');
  pat(F.cm, 'CM_START', 'Medication start dates');
  pat(F.cm, 'CM_END', 'Medication end dates');
  pat(F.bd, 'DIAG_DATE', 'Initial diagnosis dates');

  // (15) visit inconsistencies
  const swaps = r.sample(plain.filter((s) => s.vitals.filter((v) => v.visitName === 'CYCLE 2 DAY 1' || v.visitName === 'CYCLE 4 DAY 1').length === 2), 3);
  for (const s of swaps) {
    const v2 = src.get(s.vitals.find((v) => v.visitName === 'CYCLE 2 DAY 1')!)!;
    const v4 = src.get(s.vitals.find((v) => v.visitName === 'CYCLE 4 DAY 1')!)!;
    set(F.vs, v2, 'VISIT_NAME', 'Cycle 4 Day 1', 'VISIT LABEL INCONSISTENT WITH DATE', 15, 'Visit labels swapped at entry (Cycle 4 Day 1 dated before Cycle 2 Day 1); corrected by site.');
    set(F.vs, v4, 'VISIT_NAME', 'Cycle 2 Day 1', 'VISIT LABEL INCONSISTENT WITH DATE', 15, 'Visit labels swapped at entry; corrected by site.');
  }
  const egCand = plain.filter((s) => s.ecgs.some((e) => e.visitName === 'CYCLE 2 DAY 1') && !s.ecgs.some((e) => e.visitName === 'CYCLE 4 DAY 1'));
  if (egCand.length) {
    const s = r.pick(egCand);
    const row = src.get(s.ecgs.find((e: TEcg) => e.visitName === 'CYCLE 2 DAY 1')!)!;
    set(F.eg, row, 'VISIT_NAME', 'Cycle 4 Day 1', 'VISIT LABEL INCONSISTENT WITH DATE', 15, 'ECG dated on the Cycle 2 Day 1 visit date but labelled Cycle 4 Day 1; corrected by site.');
  }
  const tuCand = rnd.flatMap((s) => {
    const post = s.scans.filter((x) => x.week !== null);
    return post.filter((x, i) => i > 0 && x.week! - post[i - 1].week! === 12 && x.week! <= 48).map((x) => ({ s, x, prevWeek: x.week! - 6 }));
  });
  if (tuCand.length) {
    const { x, prevWeek } = r.pick(tuCand);
    set(F.tu, src.get(x)!, 'VISIT_NAME', `Week ${prevWeek}`, 'VISIT LABEL INCONSISTENT WITH DATE', 15, `Scan labelled Week ${prevWeek} (that assessment was missed) but dated in the Week ${x.week} window; corrected by site.`);
  }

  // (16) temperature in F / weight in lb at two US sites (units recorded)
  const imp = T.subjects.filter((s) => s.site.imperial && !s.screenFail).flatMap((s) => s.vitals.map((v) => ({ s, v })));
  for (const { v } of r.sample(imp.filter(({ v }) => !touched.has(src.get(v)!)), 12)) {
    const row = src.get(v)!;
    const f = Math.round((v.temp * 9) / 5 * 10 + 320) / 10;
    v.tempF = f;
    row.TEMP = f.toFixed(1);
    row.TEMP_UNIT = 'F';
    push({ file: F.vs.name, row, column: 'TEMP;TEMP_UNIT', type: 'NON-STANDARD UNIT (TEMPERATURE IN F)', problem: 16, raw: `${row.TEMP} F`, corrected: `${(Math.round((((f - 32) * 5) / 9) * 10) / 10).toFixed(1)} C`, subject: row.SUBJECT_ID, resolution: 'Not an error: unit recorded. Keep original in VSORRES/VSORRESU; VSSTRESN = (F - 32) x 5/9 in C.' });
  }
  for (const { v } of r.sample(imp.filter(({ v }) => !touched.has(src.get(v)!)), 10)) {
    const row = src.get(v)!;
    const lb = Math.round(v.weight * 2.20462 * 10) / 10;
    v.weightLb = lb;
    row.WEIGHT = lb.toFixed(1);
    row.WEIGHT_UNIT = 'lb';
    push({ file: F.vs.name, row, column: 'WEIGHT;WEIGHT_UNIT', type: 'NON-STANDARD UNIT (WEIGHT IN LB)', problem: 16, raw: `${row.WEIGHT} lb`, corrected: `${(Math.round(lb * 0.45359237 * 10) / 10).toFixed(1)} kg`, subject: row.SUBJECT_ID, resolution: 'Not an error: unit recorded. Keep original in VSORRES/VSORRESU; VSSTRESN = lb x 0.45359237 in kg.' });
  }

  // (17) whitespace / case variants in coded text
  const ws = (f: RawFile, col: string, n: number, fx: (v: string) => string) => {
    for (const row of r.sample(free(f.rows.filter((x) => x[col])), n)) set(f, row, col, fx(row[col]), 'WHITESPACE/CASE VARIANT IN CODED TEXT', 17, 'Trim and standardize to the dictionary term before mapping.');
  };
  ws(F.ae, 'CODED_PT', 3, (v) => ` ${v}`);
  ws(F.ae, 'CODED_PT', 2, (v) => v.toUpperCase());
  ws(F.ae, 'CODED_SOC', 2, (v) => `${v.toLowerCase()} `);
  ws(F.cm, 'CODED_NAME', 3, (v) => ` ${v.charAt(0)}${v.slice(1).toLowerCase()}`);
  ws(F.mh, 'CODED_PT', 3, (v) => `${v.toLowerCase()} `);

  // true findings worth flagging so they are not "cleaned"
  for (const id of T.special.dispensingError) {
    const s = subj.get(id)!;
    const x = s.flags.errAllPlacebo ? s.exCbx[0] : s.exCbx.find((e) => e.content === 'CBX-417')!;
    const row = src.get(x);
    if (row) push({ file: F.exs.name, row, column: 'KIT_NUMBER', type: 'TRUE FINDING (NOT AN ERROR): DISPENSING ERROR', problem: 5, raw: row.KIT_NUMBER, corrected: row.KIT_NUMBER, subject: id, resolution: `${s.dispensingError}. Real event (major deviation): EXTRT follows the kit content; TRT01A per SAP rule.` });
  }
  for (const id of T.special.misStrat) {
    const s = subj.get(id)!;
    const row = subjRows.get(s)!.rnd;
    if (row) push({ file: F.rnd.name, row, column: s.misStrat!.startsWith('ECOG') ? 'STRAT_ECOG' : 'STRAT_PRIOR_IO', type: 'TRUE FINDING (NOT AN ERROR): STRATIFICATION ERROR', problem: null, raw: s.misStrat!.startsWith('ECOG') ? row.STRAT_ECOG : row.STRAT_PRIOR_IO, corrected: s.misStrat!.startsWith('ECOG') ? row.STRAT_ECOG : row.STRAT_PRIOR_IO, subject: id, resolution: `${s.misStrat}. Do not change IxRS data: stratified analyses use strata as randomized (STRAT1R/STRAT2R); CRF values go to ECOGBL/PRIORIO.` });
  }
  for (const s of rnd)
    for (const a of s.aes)
      if (a.relCbx === null) {
        const row = src.get(a)!;
        push({ file: F.ae.name, row, column: 'AE_REL_CBX', type: 'TRUE FINDING: MISSING CAUSALITY', problem: null, raw: '', corrected: '', subject: s.subjid, resolution: 'Query unresolved at data cutoff. SDTM AEREL stays null; ADaM AREL imputed as RELATED (conservative SAP rule).' });
      }
}

function isoP(p: PartialDate) {
  if (p.m === undefined) return String(p.y);
  if (p.d === undefined) return `${p.y}-${String(p.m).padStart(2, '0')}`;
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export function rawTables(R: RawResult): Table[] {
  return R.files.map((f) => ({ name: f.name.replace(/\.csv$/, ''), columns: f.columns, rows: f.rows }));
}
