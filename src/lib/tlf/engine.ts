/**
 * TLF engine — computes clinical tables and figures directly from the ADaM
 * datasets, keeping, for every cell, the records that produced it. That record
 * list is what makes "Trace this value" possible: TLF cell → analysis records →
 * ADaM variables → SDTM records → raw CRF rows.
 *
 * Definitions follow the study SAP (see content/documents/sap.md). Anything
 * simplified for teaching is stated in the table's footnotes.
 */
import { loadDataset, type Row } from '../datasets';
import { summarize, fmtFixed, pct } from '../stats/descriptive';
import { kaplanMeier, logRank, coxPH, type SurvRecord } from '../stats/survival';
import { clopperPearson } from '../stats/tests';
import { TLF_BY_ID, type TlfSpec } from './catalogue';

export interface TlfCell {
  /** Display text (already formatted). */
  text: string;
  /** Numeric value when the cell is a number. */
  value?: number;
  /** Row keys (USUBJID or USUBJID|SEQ) that produced this cell. */
  keys?: string[];
  /** Dataset the keys refer to. */
  source?: string;
  /** Human-readable derivation ("n = subjects with SAFFL='Y' and SEX='F' in the CBX-417 arm"). */
  definition?: string;
  align?: 'left' | 'right' | 'center';
  emphasis?: boolean;
  indent?: number;
}

export interface TlfTable {
  spec: TlfSpec;
  title: string;
  subtitle: string;
  columns: { key: string; label: string; sub?: string }[];
  rows: { cells: Record<string, TlfCell>; section?: boolean }[];
  footnotes: string[];
  /** Figure payload when the output is a figure. */
  figure?: FigureData;
}

export interface FigureData {
  kind: 'km' | 'forest' | 'waterfall';
  km?: {
    arms: { label: string; color: string; steps: { time: number; surv: number }[]; censor: { time: number; surv: number }[]; atRisk: number[] }[];
    times: number[];
    summary: { label: string; events: number; n: number; median: number | null; lower: number | null; upper: number | null }[];
    hr?: { value: number; lower: number; upper: number; p: number };
    xLabel: string;
  };
  forest?: { label: string; n: number; events: number; hr: number; lower: number; upper: number }[];
  waterfall?: { subject: string; value: number; response: string }[];
}

const ARM_ORDER = ['CBX-417 + Docetaxel', 'Placebo + Docetaxel'];
const ARM_COLORS = ['var(--viz-1)', 'var(--viz-2)'];

const key = (r: Row, seqVar?: string) => (seqVar ? `${r.USUBJID}|${r[seqVar]}` : String(r.USUBJID));

function armsOf(adsl: Row[], variable: 'TRT01P' | 'TRT01A'): string[] {
  const present = [...new Set(adsl.map((r) => String(r[variable] ?? '')).filter(Boolean))];
  return [...ARM_ORDER.filter((a) => present.includes(a)), ...present.filter((a) => !ARM_ORDER.includes(a))];
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/* ------------------------------ Demographics ------------------------------ */

interface ContinuousSpec {
  label: string;
  variable: string;
  decimals: number;
}
interface CategoricalSpec {
  label: string;
  variable: string;
  order?: string[];
}

const DEMOG_CONTINUOUS: ContinuousSpec[] = [
  { label: 'Age (years)', variable: 'AGE', decimals: 1 },
  { label: 'Weight (kg)', variable: 'WEIGHTBL', decimals: 1 },
  { label: 'Body mass index (kg/m²)', variable: 'BMIBL', decimals: 1 },
];
const DEMOG_CATEGORICAL: CategoricalSpec[] = [
  { label: 'Age group', variable: 'AGEGR1', order: ['<65', '>=65'] },
  { label: 'Sex', variable: 'SEX', order: ['M', 'F'] },
  { label: 'Race', variable: 'RACE' },
  { label: 'Region', variable: 'REGION1' },
  { label: 'ECOG performance status', variable: 'ECOGBL', order: ['0', '1'] },
  { label: 'Histology', variable: 'HISTOL' },
  { label: 'Prior anti-PD-(L)1 therapy', variable: 'PRIORIO', order: ['Y', 'N'] },
];

function demographics(adsl: Row[], spec: TlfSpec): TlfTable {
  const pop = adsl.filter((r) => r.ITTFL === 'Y');
  const arms = armsOf(pop, 'TRT01P');
  const groups = [...arms.map((a) => ({ label: a, rows: pop.filter((r) => r.TRT01P === a) })), { label: 'Total', rows: pop }];
  const columns = groups.map((g) => ({ key: g.label, label: g.label, sub: `N = ${g.rows.length}` }));
  const rows: TlfTable['rows'] = [];

  const push = (label: string, cells: Record<string, TlfCell>, indent = 0, section = false) => {
    rows.push({ cells: { __label: { text: label, align: 'left', indent, emphasis: section }, ...cells }, section });
  };

  for (const c of DEMOG_CONTINUOUS) {
    push(c.label, {}, 0, true);
    const stats = groups.map((g) => ({ g, s: summarize(g.rows.map((r) => num(r[c.variable]))) }));
    push(
      'n',
      Object.fromEntries(
        stats.map(({ g, s }) => [
          g.label,
          { text: String(s.n), value: s.n, align: 'right', keys: g.rows.filter((r) => num(r[c.variable]) !== null).map((r) => key(r)), source: 'oncology/adam/adsl', definition: `Subjects in ${g.label} (ITT) with a non-missing ${c.variable}` },
        ]),
      ),
      1,
    );
    push(
      'Mean (SD)',
      Object.fromEntries(
        stats.map(({ g, s }) => [
          g.label,
          {
            text: `${fmtFixed(s.mean, c.decimals)} (${fmtFixed(s.sd, c.decimals + 1)})`,
            value: s.mean,
            align: 'right',
            keys: g.rows.map((r) => key(r)),
            source: 'oncology/adam/adsl',
            definition: `Mean and standard deviation of ${c.variable} over ${s.n} subjects in ${g.label}`,
          },
        ]),
      ),
      1,
    );
    push(
      'Median',
      Object.fromEntries(stats.map(({ g, s }) => [g.label, { text: fmtFixed(s.median, c.decimals), value: s.median, align: 'right', keys: g.rows.map((r) => key(r)), source: 'oncology/adam/adsl', definition: `Median ${c.variable} (SAS QNTLDEF=5)` }])),
      1,
    );
    push(
      'Q1, Q3',
      Object.fromEntries(stats.map(({ g, s }) => [g.label, { text: `${fmtFixed(s.q1, c.decimals)}, ${fmtFixed(s.q3, c.decimals)}`, align: 'right' }])),
      1,
    );
    push(
      'Min, Max',
      Object.fromEntries(stats.map(({ g, s }) => [g.label, { text: `${fmtFixed(s.min, c.decimals)}, ${fmtFixed(s.max, c.decimals)}`, align: 'right' }])),
      1,
    );
  }

  for (const c of DEMOG_CATEGORICAL) {
    const levels = c.order ?? [...new Set(pop.map((r) => String(r[c.variable] ?? '')).filter(Boolean))].sort();
    push(`${c.label}, n (%)`, {}, 0, true);
    for (const lv of levels) {
      push(
        lv,
        Object.fromEntries(
          groups.map((g) => {
            const matching = g.rows.filter((r) => String(r[c.variable] ?? '') === lv);
            return [
              g.label,
              {
                text: `${matching.length} (${pct(matching.length, g.rows.length)})`,
                value: matching.length,
                align: 'right',
                keys: matching.map((r) => key(r)),
                source: 'oncology/adam/adsl',
                definition: `Subjects in ${g.label} (ITT) with ${c.variable} = "${lv}"; denominator = ${g.rows.length} (all ITT subjects in the column)`,
              },
            ];
          }),
        ),
        1,
      );
    }
  }

  return {
    spec,
    title: `Table ${spec.number}  ${spec.title}`,
    subtitle: spec.population,
    columns: [{ key: '__label', label: '' }, ...columns],
    rows,
    footnotes: [
      'Percentages use the number of subjects in the intent-to-treat population in each column as the denominator.',
      'Continuous variables: n, mean (standard deviation), median, first and third quartiles (SAS QNTLDEF=5 definition), minimum and maximum.',
      'Programmed live from ADSL in the browser for teaching; a real table would be produced by a validated SAS or R program.',
    ],
  };
}

/* ------------------------------- Disposition ------------------------------- */

function disposition(adsl: Row[], spec: TlfSpec): TlfTable {
  const arms = armsOf(adsl, 'TRT01P');
  const groups = [...arms.map((a) => ({ label: a, rows: adsl.filter((r) => r.TRT01P === a) })), { label: 'Total', rows: adsl }];
  const rows: TlfTable['rows'] = [];
  const push = (label: string, filter: (r: Row) => boolean, definition: string, indent = 0, denomAll = true) => {
    rows.push({
      cells: {
        __label: { text: label, align: 'left', indent },
        ...Object.fromEntries(
          groups.map((g) => {
            const m = g.rows.filter(filter);
            return [
              g.label,
              {
                text: denomAll ? `${m.length} (${pct(m.length, g.rows.length)})` : String(m.length),
                value: m.length,
                align: 'right' as const,
                keys: m.map((r) => key(r)),
                source: 'oncology/adam/adsl',
                definition: `${definition} — ${g.label}`,
              },
            ];
          }),
        ),
      },
    });
  };
  push('Randomized', () => true, 'All randomized subjects', 0, false);
  push('Treated (safety population)', (r) => r.SAFFL === 'Y', "SAFFL = 'Y'");
  push('Completed treatment', (r) => r.EOTSTT === 'COMPLETED', "EOTSTT = 'COMPLETED'");
  push('Discontinued treatment', (r) => r.EOTSTT === 'DISCONTINUED', "EOTSTT = 'DISCONTINUED'");
  const reasons = [...new Set(adsl.map((r) => String(r.DCTREAS ?? '')).filter(Boolean))].sort();
  for (const reason of reasons) push(reason, (r) => String(r.DCTREAS ?? '') === reason, `DCTREAS = "${reason}"`, 1);
  push('Ongoing in study at data cutoff', (r) => r.EOSSTT === 'ONGOING', "EOSSTT = 'ONGOING'");
  push('Died', (r) => r.DTHFL === 'Y', "DTHFL = 'Y'");
  return {
    spec,
    title: `Table ${spec.number}  ${spec.title}`,
    subtitle: spec.population,
    columns: [{ key: '__label', label: '' }, ...groups.map((g) => ({ key: g.label, label: g.label, sub: `N = ${g.rows.length}` }))],
    rows,
    footnotes: ['Percentages use all randomized subjects in each column as the denominator.'],
  };
}

/* --------------------------------- AE tables -------------------------------- */

function aeOverview(adsl: Row[], adae: Row[], spec: TlfSpec): TlfTable {
  const saf = adsl.filter((r) => r.SAFFL === 'Y');
  const arms = armsOf(saf, 'TRT01A');
  const groups = arms.map((a) => ({ label: a, rows: saf.filter((r) => r.TRT01A === a) }));
  const teae = adae.filter((r) => r.TRTEMFL === 'Y');
  const rows: TlfTable['rows'] = [];
  const pushSubjects = (label: string, filter: (r: Row) => boolean, definition: string) => {
    rows.push({
      cells: {
        __label: { text: label, align: 'left' },
        ...Object.fromEntries(
          groups.map((g) => {
            const subs = new Set(teae.filter((e) => filter(e)).map((e) => String(e.USUBJID)));
            const inArm = g.rows.filter((r) => subs.has(String(r.USUBJID)));
            return [
              g.label,
              {
                text: `${inArm.length} (${pct(inArm.length, g.rows.length)})`,
                value: inArm.length,
                align: 'right' as const,
                keys: inArm.map((r) => key(r)),
                source: 'oncology/adam/adsl',
                definition: `${definition}; denominator = ${g.rows.length} subjects treated with ${g.label}`,
              },
            ];
          }),
        ),
      },
    });
  };
  pushSubjects('Any treatment-emergent adverse event (TEAE)', () => true, "Subjects with ≥1 TEAE (TRTEMFL='Y')");
  pushSubjects('Grade ≥3 TEAE', (e) => (num(e.ATOXGRN) ?? 0) >= 3, 'Subjects with ≥1 TEAE of CTCAE grade 3 or higher');
  pushSubjects('Serious TEAE', (e) => e.AESER === 'Y', "Subjects with ≥1 serious TEAE (AESER='Y')");
  pushSubjects('TEAE leading to treatment discontinuation', (e) => String(e.AEACN ?? '') === 'DRUG WITHDRAWN', "Subjects with ≥1 TEAE with AEACN='DRUG WITHDRAWN'");
  pushSubjects('TEAE leading to dose reduction or interruption', (e) => ['DOSE REDUCED', 'DRUG INTERRUPTED'].includes(String(e.AEACN ?? '')), 'Subjects with ≥1 TEAE leading to dose reduction or interruption');
  pushSubjects('TEAE with outcome of death (grade 5)', (e) => (num(e.ATOXGRN) ?? 0) === 5 || e.AEOUT === 'FATAL', 'Subjects with ≥1 fatal TEAE');
  pushSubjects('Treatment-related TEAE', (e) => String(e.AREL ?? '').toUpperCase().startsWith('REL') || e.AREL === 'Y', 'Subjects with ≥1 TEAE assessed as related to study treatment');
  return {
    spec,
    title: `Table ${spec.number}  ${spec.title}`,
    subtitle: spec.population,
    columns: [{ key: '__label', label: '' }, ...groups.map((g) => ({ key: g.label, label: g.label, sub: `N = ${g.rows.length}` }))],
    rows,
    footnotes: [
      'A treatment-emergent adverse event starts on or after the first dose and no later than 30 days after the last dose (TRTEMFL = "Y").',
      'Subjects are counted once in each row regardless of how many events they had. Percentages use the number of treated subjects in the column.',
      'Analysis is by actual treatment (TRT01A), which differs from planned treatment for the three subjects affected by dispensing errors.',
    ],
  };
}

function aeBySocPt(adsl: Row[], adae: Row[], spec: TlfSpec, opts: { minPct?: number; grade3?: boolean; serious?: boolean } = {}): TlfTable {
  const saf = adsl.filter((r) => r.SAFFL === 'Y');
  const arms = armsOf(saf, 'TRT01A');
  const groups = arms.map((a) => ({ label: a, rows: saf.filter((r) => r.TRT01A === a) }));
  let teae = adae.filter((r) => r.TRTEMFL === 'Y');
  if (opts.grade3) teae = teae.filter((r) => (num(r.ATOXGRN) ?? 0) >= 3);
  if (opts.serious) teae = teae.filter((r) => r.AESER === 'Y');
  const socs = [...new Set(teae.map((r) => String(r.AEBODSYS ?? '')))].filter(Boolean);
  const rows: TlfTable['rows'] = [];
  const subjectsWith = (rowsArm: Row[], filter: (e: Row) => boolean) => {
    const subs = new Set(teae.filter(filter).map((e) => String(e.USUBJID)));
    return rowsArm.filter((r) => subs.has(String(r.USUBJID)));
  };
  // Order SOCs by overall frequency, then PTs within SOC
  const socOrder = socs
    .map((soc) => ({ soc, n: new Set(teae.filter((e) => e.AEBODSYS === soc).map((e) => e.USUBJID)).size }))
    .sort((a, b) => b.n - a.n || a.soc.localeCompare(b.soc));
  const cellsFor = (filter: (e: Row) => boolean, definition: string) =>
    Object.fromEntries(
      groups.map((g) => {
        const subs = subjectsWith(g.rows, filter);
        return [
          g.label,
          {
            text: `${subs.length} (${pct(subs.length, g.rows.length)})`,
            value: subs.length,
            align: 'right' as const,
            keys: subs.map((r) => key(r)),
            source: 'oncology/adam/adsl',
            definition: `${definition}; denominator = ${g.rows.length} treated subjects in ${g.label}`,
          },
        ];
      }),
    );
  rows.push({ cells: { __label: { text: 'Subjects with at least one event', align: 'left', emphasis: true }, ...cellsFor(() => true, 'Subjects with ≥1 qualifying TEAE') } });
  for (const { soc } of socOrder) {
    const socCells = cellsFor((e) => e.AEBODSYS === soc, `Subjects with ≥1 TEAE in SOC "${soc}"`);
    const maxPctSoc = Math.max(...groups.map((g) => ((socCells[g.label].value ?? 0) / Math.max(1, g.rows.length)) * 100));
    if (opts.minPct && maxPctSoc < opts.minPct) continue;
    rows.push({ cells: { __label: { text: soc, align: 'left', emphasis: true }, ...socCells }, section: true });
    const pts = [...new Set(teae.filter((e) => e.AEBODSYS === soc).map((e) => String(e.AEDECOD ?? '')))]
      .map((pt) => ({ pt, n: new Set(teae.filter((e) => e.AEDECOD === pt).map((e) => e.USUBJID)).size }))
      .sort((a, b) => b.n - a.n || a.pt.localeCompare(b.pt));
    for (const { pt } of pts) {
      const ptCells = cellsFor((e) => e.AEDECOD === pt, `Subjects with ≥1 TEAE with preferred term "${pt}"`);
      const maxPctPt = Math.max(...groups.map((g) => ((ptCells[g.label].value ?? 0) / Math.max(1, g.rows.length)) * 100));
      if (opts.minPct && maxPctPt < opts.minPct) continue;
      rows.push({ cells: { __label: { text: pt, align: 'left', indent: 1 }, ...ptCells } });
    }
  }
  return {
    spec,
    title: `Table ${spec.number}  ${spec.title}`,
    subtitle: spec.population,
    columns: [{ key: '__label', label: 'System organ class / Preferred term' }, ...groups.map((g) => ({ key: g.label, label: g.label, sub: `N = ${g.rows.length}` }))],
    rows,
    footnotes: [
      'Subjects are counted once per system organ class and once per preferred term, at the highest grade reported.',
      opts.minPct ? `Only terms reported in at least ${opts.minPct}% of subjects in either arm are shown.` : 'All reported terms are shown.',
      'Coding is MedDRA-like and illustrative: the term and system organ class names in this synthetic dataset are not an extract of the MedDRA dictionary.',
      'System organ classes are ordered by decreasing overall frequency; preferred terms are ordered by decreasing frequency within each class.',
    ],
  };
}

/* ------------------------------- Efficacy ---------------------------------- */

function tteTable(adsl: Row[], adtte: Row[], spec: TlfSpec, paramcd: 'PFS' | 'OS'): TlfTable {
  const itt = adsl.filter((r) => r.ITTFL === 'Y');
  const arms = armsOf(itt, 'TRT01P');
  const recs = adtte.filter((r) => r.PARAMCD === paramcd);
  const byArm = arms.map((a) => ({
    label: a,
    rows: recs.filter((r) => r.TRTP === a),
  }));
  const kmByArm = byArm.map((g) => ({
    ...g,
    km: kaplanMeier(
      g.rows.map<SurvRecord>((r) => ({ time: (num(r.AVAL) ?? 0) / 30.4375, event: num(r.CNSR) === 0 ? 1 : 0 })),
      { ciType: 'log-log' },
    ),
  }));
  const survRecords: SurvRecord[] = recs.map((r) => ({
    time: (num(r.AVAL) ?? 0) / 30.4375,
    event: num(r.CNSR) === 0 ? 1 : 0,
    group: String(r.TRTP ?? ''),
    strata: `${r.STRAT1R ?? ''}|${r.STRAT2R ?? ''}`,
    covariates: [String(r.TRTP) === arms[0] ? 1 : 0],
  }));
  const lr = logRank(survRecords);
  const lrUnstrat = logRank(survRecords.map((r) => ({ ...r, strata: undefined })));
  const cox = coxPH(survRecords, { ties: 'efron' });
  const rows: TlfTable['rows'] = [];
  const cellRow = (label: string, fn: (g: (typeof kmByArm)[number]) => TlfCell, indent = 0) => {
    rows.push({ cells: { __label: { text: label, align: 'left', indent }, ...Object.fromEntries(kmByArm.map((g) => [g.label, fn(g)])) } });
  };
  cellRow('Subjects in analysis', (g) => ({ text: String(g.rows.length), value: g.rows.length, align: 'right', keys: g.rows.map((r) => key(r)), source: 'oncology/adam/adtte', definition: `ITT subjects with a ${paramcd} record` }));
  cellRow('Events, n (%)', (g) => {
    const ev = g.rows.filter((r) => num(r.CNSR) === 0);
    return { text: `${ev.length} (${pct(ev.length, g.rows.length)})`, value: ev.length, align: 'right', keys: ev.map((r) => key(r)), source: 'oncology/adam/adtte', definition: `Records with CNSR = 0 (event) for ${paramcd}` };
  });
  cellRow('Censored, n (%)', (g) => {
    const c = g.rows.filter((r) => num(r.CNSR) !== 0);
    return { text: `${c.length} (${pct(c.length, g.rows.length)})`, value: c.length, align: 'right', keys: c.map((r) => key(r)), source: 'oncology/adam/adtte', definition: 'Records with CNSR > 0 (censored)' };
  });
  cellRow('Median (months)', (g) => ({ text: g.km.median === null ? 'NE' : fmtFixed(g.km.median, 1), value: g.km.median ?? undefined, align: 'right', definition: 'Kaplan–Meier median' }));
  cellRow('95% CI for median', (g) => ({
    text: `${g.km.medianLower === null ? 'NE' : fmtFixed(g.km.medianLower, 1)}, ${g.km.medianUpper === null ? 'NE' : fmtFixed(g.km.medianUpper, 1)}`,
    align: 'right',
    definition: 'Brookmeyer–Crowley method with the complementary log-log transformation (SAS PROC LIFETEST CONFTYPE=LOGLOG default)',
  }));
  for (const t of [6, 12, 18]) {
    cellRow(`${t}-month rate (%)`, (g) => {
      let s = 1;
      for (const st of g.km.steps) {
        if (st.time > t) break;
        s = st.surv;
      }
      return { text: fmtFixed(s * 100, 1), value: s, align: 'right', definition: `Kaplan–Meier estimate of S(${t} months)` };
    }, 1);
  }
  rows.push({
    cells: {
      __label: { text: `Hazard ratio (${arms[0]} vs ${arms[1]})`, align: 'left', emphasis: true },
      [arms[0]]: { text: `${fmtFixed(cox.hr[0], 2)} (${fmtFixed(cox.hrLower[0], 2)}, ${fmtFixed(cox.hrUpper[0], 2)})`, value: cox.hr[0], align: 'right', definition: 'Stratified Cox proportional-hazards model (Efron ties), stratified by the randomization strata; 95% Wald confidence interval' },
      [arms[1]]: { text: '', align: 'right' },
    },
  });
  rows.push({
    cells: {
      __label: { text: 'Stratified log-rank p-value', align: 'left', emphasis: true },
      [arms[0]]: { text: lr.p < 0.0001 ? '<0.0001' : fmtFixed(lr.p, 4), value: lr.p, align: 'right', definition: 'Stratified log-rank test using the randomization strata' },
      [arms[1]]: { text: '', align: 'right' },
    },
  });
  rows.push({
    cells: {
      __label: { text: 'Unstratified log-rank p-value', align: 'left', indent: 1 },
      [arms[0]]: { text: lrUnstrat.p < 0.0001 ? '<0.0001' : fmtFixed(lrUnstrat.p, 4), value: lrUnstrat.p, align: 'right', definition: 'Unstratified log-rank test (sensitivity analysis)' },
      [arms[1]]: { text: '', align: 'right' },
    },
  });
  return {
    spec,
    title: `Table ${spec.number}  ${spec.title}`,
    subtitle: spec.population,
    columns: [{ key: '__label', label: '' }, ...kmByArm.map((g) => ({ key: g.label, label: g.label, sub: `N = ${g.rows.length}` }))],
    rows,
    footnotes: [
      paramcd === 'PFS'
        ? 'Progression-free survival is the time from randomization to documented progression per RECIST 1.1 or death from any cause, censored per the SAP rules (CNSR values 1–4 identify the censoring reason).'
        : 'Overall survival is the time from randomization to death from any cause; subjects alive at the data cutoff are censored at the last date known to be alive.',
      'Hazard ratios come from a Cox model with Efron handling of ties; SAS PROC PHREG uses Breslow by default, which can change the estimate slightly.',
      'Median survival and its confidence interval use the Kaplan–Meier estimator with the complementary log-log transformation.',
    ],
  };
}

function ormTable(adsl: Row[], adrs: Row[], spec: TlfSpec): TlfTable {
  const itt = adsl.filter((r) => r.ITTFL === 'Y');
  const arms = armsOf(itt, 'TRT01P');
  const best = adrs.filter((r) => r.PARAMCD === 'CBOR' || r.PARAMCD === 'BOR');
  const groups = arms.map((a) => ({ label: a, rows: itt.filter((r) => r.TRT01P === a) }));
  const responseOf = (usubjid: string) => String(best.find((r) => r.USUBJID === usubjid)?.AVALC ?? 'NE');
  const rows: TlfTable['rows'] = [];
  const levels = ['CR', 'PR', 'SD', 'PD', 'NE'];
  const labels: Record<string, string> = { CR: 'Complete response (CR)', PR: 'Partial response (PR)', SD: 'Stable disease (SD)', PD: 'Progressive disease (PD)', NE: 'Not evaluable (NE)' };
  for (const lv of levels) {
    rows.push({
      cells: {
        __label: { text: labels[lv], align: 'left' },
        ...Object.fromEntries(
          groups.map((g) => {
            const m = g.rows.filter((r) => responseOf(String(r.USUBJID)) === lv);
            return [g.label, { text: `${m.length} (${pct(m.length, g.rows.length)})`, value: m.length, align: 'right' as const, keys: m.map((r) => key(r)), source: 'oncology/adam/adsl', definition: `ITT subjects whose confirmed best overall response is ${lv}` }];
          }),
        ),
      },
    });
  }
  rows.push({
    cells: {
      __label: { text: 'Objective response rate (CR + PR)', align: 'left', emphasis: true },
      ...Object.fromEntries(
        groups.map((g) => {
          const m = g.rows.filter((r) => ['CR', 'PR'].includes(responseOf(String(r.USUBJID))));
          const ci = clopperPearson(m.length, g.rows.length);
          return [
            g.label,
            {
              text: `${m.length} (${pct(m.length, g.rows.length)})`,
              value: m.length,
              align: 'right' as const,
              keys: m.map((r) => key(r)),
              source: 'oncology/adam/adsl',
              definition: `Confirmed responders; 95% Clopper–Pearson CI ${fmtFixed(ci.lower * 100, 1)}%–${fmtFixed(ci.upper * 100, 1)}%`,
            },
          ];
        }),
      ),
    },
  });
  rows.push({
    cells: {
      __label: { text: '95% CI (Clopper–Pearson)', align: 'left', indent: 1 },
      ...Object.fromEntries(
        groups.map((g) => {
          const m = g.rows.filter((r) => ['CR', 'PR'].includes(responseOf(String(r.USUBJID))));
          const ci = clopperPearson(m.length, g.rows.length);
          return [g.label, { text: `${fmtFixed(ci.lower * 100, 1)}, ${fmtFixed(ci.upper * 100, 1)}`, align: 'right' as const, definition: 'Exact binomial (Clopper–Pearson) confidence interval for the response rate' }];
        }),
      ),
    },
  });
  return {
    spec,
    title: `Table ${spec.number}  ${spec.title}`,
    subtitle: spec.population,
    columns: [{ key: '__label', label: 'Best overall response' }, ...groups.map((g) => ({ key: g.label, label: g.label, sub: `N = ${g.rows.length}` }))],
    rows,
    footnotes: [
      'Best overall response is the best confirmed response per RECIST 1.1 recorded from randomization until documented progression.',
      'Subjects with no post-baseline tumour assessment are counted as not evaluable (NE) and remain in the denominator.',
    ],
  };
}

/* ------------------------------- Figures ---------------------------------- */

function kmFigure(adsl: Row[], adtte: Row[], spec: TlfSpec, paramcd: 'PFS' | 'OS'): TlfTable {
  const itt = adsl.filter((r) => r.ITTFL === 'Y');
  const arms = armsOf(itt, 'TRT01P');
  const recs = adtte.filter((r) => r.PARAMCD === paramcd);
  const maxMonths = Math.max(...recs.map((r) => (num(r.AVAL) ?? 0) / 30.4375));
  const tickEvery = maxMonths > 24 ? 6 : 3;
  const times = Array.from({ length: Math.floor(maxMonths / tickEvery) + 1 }, (_, i) => i * tickEvery);
  const armData = arms.map((a, i) => {
    const rows = recs.filter((r) => r.TRTP === a);
    const surv = rows.map<SurvRecord>((r) => ({ time: (num(r.AVAL) ?? 0) / 30.4375, event: num(r.CNSR) === 0 ? 1 : 0 }));
    const km = kaplanMeier(surv, { ciType: 'log-log' });
    const steps = [{ time: 0, surv: 1 }, ...km.steps.filter((s) => s.nEvent > 0).map((s) => ({ time: s.time, surv: s.surv }))];
    const censor = km.censorTimes.map((t) => {
      let s = 1;
      for (const st of km.steps) {
        if (st.time > t) break;
        s = st.surv;
      }
      return { time: t, surv: s };
    });
    return {
      label: a,
      color: ARM_COLORS[i] ?? 'var(--viz-6)',
      steps,
      censor,
      atRisk: times.map((t) => surv.filter((r) => r.time >= t).length),
      km,
      n: rows.length,
    };
  });
  const survRecords: SurvRecord[] = recs.map((r) => ({
    time: (num(r.AVAL) ?? 0) / 30.4375,
    event: num(r.CNSR) === 0 ? 1 : 0,
    group: String(r.TRTP ?? ''),
    strata: `${r.STRAT1R ?? ''}|${r.STRAT2R ?? ''}`,
    covariates: [String(r.TRTP) === arms[0] ? 1 : 0],
  }));
  const cox = coxPH(survRecords, { ties: 'efron' });
  const lr = logRank(survRecords);
  return {
    spec,
    title: `Figure ${spec.number}  ${spec.title}`,
    subtitle: spec.population,
    columns: [],
    rows: [],
    footnotes: [
      'Tick marks indicate censored observations. The number-at-risk row counts subjects still in follow-up and event-free at each time point.',
      'Hazard ratio from a stratified Cox model; p-value from the stratified log-rank test.',
    ],
    figure: {
      kind: 'km',
      km: {
        arms: armData.map(({ label, color, steps, censor, atRisk }) => ({ label, color, steps, censor, atRisk })),
        times,
        summary: armData.map((a) => ({ label: a.label, events: a.km.events, n: a.n, median: a.km.median, lower: a.km.medianLower, upper: a.km.medianUpper })),
        hr: { value: cox.hr[0], lower: cox.hrLower[0], upper: cox.hrUpper[0], p: lr.p },
        xLabel: paramcd === 'PFS' ? 'Months from randomization' : 'Months from randomization',
      },
    },
  };
}

function forestFigure(adsl: Row[], adtte: Row[], spec: TlfSpec): TlfTable {
  const recs = adtte.filter((r) => r.PARAMCD === 'PFS');
  const arms = armsOf(adsl.filter((r) => r.ITTFL === 'Y'), 'TRT01P');
  const subgroups: { label: string; filter: (r: Row) => boolean }[] = [
    { label: 'All subjects', filter: () => true },
    { label: 'Age < 65', filter: (r) => String(r.AGEGR1) === '<65' },
    { label: 'Age ≥ 65', filter: (r) => String(r.AGEGR1) === '>=65' },
    { label: 'Male', filter: (r) => r.SEX === 'M' },
    { label: 'Female', filter: (r) => r.SEX === 'F' },
    { label: 'ECOG 0', filter: (r) => String(r.ECOGBL) === '0' },
    { label: 'ECOG 1', filter: (r) => String(r.ECOGBL) === '1' },
    { label: 'Non-squamous', filter: (r) => String(r.HISTOL ?? '').toLowerCase().includes('non') },
    { label: 'Squamous', filter: (r) => String(r.HISTOL ?? '').toLowerCase() === 'squamous' },
    { label: 'Prior anti-PD-(L)1: yes', filter: (r) => r.PRIORIO === 'Y' },
    { label: 'Prior anti-PD-(L)1: no', filter: (r) => r.PRIORIO === 'N' },
  ];
  const forest = subgroups
    .map((s) => {
      const rows = recs.filter(s.filter);
      if (rows.length < 20) return null;
      const surv: SurvRecord[] = rows.map((r) => ({
        time: (num(r.AVAL) ?? 0) / 30.4375,
        event: num(r.CNSR) === 0 ? 1 : 0,
        covariates: [String(r.TRTP) === arms[0] ? 1 : 0],
      }));
      if (new Set(surv.map((x) => x.covariates![0])).size < 2) return null;
      try {
        const fit = coxPH(surv, { ties: 'efron' });
        return { label: s.label, n: rows.length, events: surv.filter((x) => x.event === 1).length, hr: fit.hr[0], lower: fit.hrLower[0], upper: fit.hrUpper[0] };
      } catch {
        return null;
      }
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  return {
    spec,
    title: `Figure ${spec.number}  ${spec.title}`,
    subtitle: spec.population,
    columns: [],
    rows: [],
    footnotes: [
      'Unstratified Cox models within each subgroup; subgroups with fewer than 20 subjects are not shown.',
      'Subgroup analyses are exploratory: the trial was not powered for them, no multiplicity adjustment is applied, and apparent differences are frequently noise.',
    ],
    figure: { kind: 'forest', forest },
  };
}

function waterfallFigure(adsl: Row[], adtr: Row[], adrs: Row[], spec: TlfSpec): TlfTable {
  const best = adtr.filter((r) => r.PARAMCD === 'BPCHG' || r.PARAMCD === 'SUMDIAM');
  const byId = new Map<string, number>();
  if (best.some((r) => r.PARAMCD === 'BPCHG')) {
    for (const r of best.filter((x) => x.PARAMCD === 'BPCHG')) byId.set(String(r.USUBJID), num(r.AVAL) ?? 0);
  } else {
    for (const r of best) {
      const v = num(r.PCHG);
      if (v === null) continue;
      const cur = byId.get(String(r.USUBJID));
      if (cur === undefined || v < cur) byId.set(String(r.USUBJID), v);
    }
  }
  const resp = new Map(adrs.filter((r) => r.PARAMCD === 'CBOR' || r.PARAMCD === 'BOR').map((r) => [String(r.USUBJID), String(r.AVALC ?? 'NE')]));
  const arms = new Map(adsl.map((r) => [String(r.USUBJID), String(r.TRT01P ?? '')]));
  const waterfall = [...byId.entries()]
    .map(([subject, value]) => ({ subject, value, response: resp.get(subject) ?? 'NE', arm: arms.get(subject) ?? '' }))
    .sort((a, b) => b.value - a.value);
  return {
    spec,
    title: `Figure ${spec.number}  ${spec.title}`,
    subtitle: spec.population,
    columns: [],
    rows: [],
    footnotes: [
      'Each bar is one subject: the best (largest reduction) percentage change from baseline in the sum of target-lesion diameters.',
      'Reference lines at −30% (partial response threshold) and +20% (progressive disease threshold) per RECIST 1.1.',
      'Subjects without a post-baseline tumour measurement cannot appear in this figure — read it alongside the response table, not instead of it.',
    ],
    figure: { kind: 'waterfall', waterfall },
  };
}

/* --------------------------------- Loader ---------------------------------- */

const cache = new Map<string, Promise<TlfTable>>();

export function buildTlf(id: string): Promise<TlfTable> {
  const cached = cache.get(id);
  if (cached) return cached;
  const spec = TLF_BY_ID.get(id);
  if (!spec) return Promise.reject(new Error(`Unknown output "${id}"`));
  const p = (async () => {
    const adsl = (await loadDataset('oncology/adam/adsl')).rows;
    switch (id) {
      case 't-demog':
        return demographics(adsl, spec);
      case 't-disp':
        return disposition(adsl, spec);
      case 't-ae-overview':
        return aeOverview(adsl, (await loadDataset('oncology/adam/adae')).rows, spec);
      case 't-ae-soc-pt':
        return aeBySocPt(adsl, (await loadDataset('oncology/adam/adae')).rows, spec, { minPct: 5 });
      case 't-ae-grade3':
        return aeBySocPt(adsl, (await loadDataset('oncology/adam/adae')).rows, spec, { grade3: true, minPct: 2 });
      case 't-sae':
        return aeBySocPt(adsl, (await loadDataset('oncology/adam/adae')).rows, spec, { serious: true });
      case 't-pfs':
        return tteTable(adsl, (await loadDataset('oncology/adam/adtte')).rows, spec, 'PFS');
      case 't-os':
        return tteTable(adsl, (await loadDataset('oncology/adam/adtte')).rows, spec, 'OS');
      case 't-orr':
        return ormTable(adsl, (await loadDataset('oncology/adam/adrs')).rows, spec);
      case 'f-km-pfs':
        return kmFigure(adsl, (await loadDataset('oncology/adam/adtte')).rows, spec, 'PFS');
      case 'f-km-os':
        return kmFigure(adsl, (await loadDataset('oncology/adam/adtte')).rows, spec, 'OS');
      case 'f-forest-pfs':
        return forestFigure(adsl, (await loadDataset('oncology/adam/adtte')).rows, spec);
      case 'f-waterfall':
        return waterfallFigure(adsl, (await loadDataset('oncology/adam/adtr')).rows, (await loadDataset('oncology/adam/adrs')).rows, spec);
      default:
        throw new Error(`Output "${id}" is not implemented yet.`);
    }
  })();
  cache.set(id, p);
  p.catch(() => cache.delete(id));
  return p;
}
