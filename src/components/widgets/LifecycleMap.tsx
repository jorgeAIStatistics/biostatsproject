/**
 * The clinical data lifecycle: what exists at each stage, who owns it, what
 * can go wrong, and where in this app you work with it.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import clsx from 'clsx';
import type { WidgetProps } from './registry';

interface Stage {
  id: string;
  short: string;
  title: string;
  owner: string;
  artifacts: string[];
  risks: string[];
  here: { label: string; to: string }[];
  blurb: string;
}

const STAGES: Stage[] = [
  {
    id: 'protocol',
    short: 'Protocol',
    title: 'Protocol & SAP',
    owner: 'Clinical scientist, biostatistician, medical writer',
    artifacts: ['Protocol', 'Schedule of assessments', 'Statistical analysis plan', 'TLF shells'],
    risks: ['Endpoints defined ambiguously', 'Estimand and intercurrent-event strategies left implicit', 'Assessment windows that the data cannot support'],
    here: [
      { label: 'Protocol synopsis', to: '/documents/protocol-synopsis' },
      { label: 'SAP', to: '/documents/sap' },
      { label: 'Clinical Trials lab', to: '/learn/trials' },
    ],
    blurb:
      'Everything downstream is a consequence of decisions made here. The endpoint definition, the populations, the visit windows and the censoring rules all become code later — so programmers read these documents, not just statisticians.',
  },
  {
    id: 'crf',
    short: 'CRF',
    title: 'CRF & database design',
    owner: 'Data management, with biometrics review',
    artifacts: ['eCRF pages', 'Annotated CRF (aCRF)', 'Edit checks', 'Data management plan'],
    risks: ['Free-text where a codelist belongs', 'Dates collected without times when a derivation needs them', 'No place to record why a value is missing'],
    here: [
      { label: 'CRF', to: '/documents/crf' },
      { label: 'Annotated CRF', to: '/documents/acrf' },
    ],
    blurb:
      'The CRF decides what can ever be known. Annotation maps each field to its SDTM destination — the first place where collection and standards meet.',
  },
  {
    id: 'raw',
    short: 'Raw data',
    title: 'Raw / collected data',
    owner: 'Sites, EDC, central vendors (labs, ECG, IxRS)',
    artifacts: ['EDC extracts', 'Central lab files', 'IxRS randomization and kit files', 'Query log'],
    risks: ['Duplicates, impossible dates, mixed units', 'Coding variants (M/Male/1)', 'Records that exist in one source only'],
    here: [{ label: 'Raw datasets', to: '/data' }, { label: 'Subject explorer', to: '/trial/subjects' }],
    blurb: 'Real raw data is messy in specific, recognizable ways. Learning those patterns is what makes you fast at cleaning and QC.',
  },
  {
    id: 'dm',
    short: 'Cleaning',
    title: 'Data management & cleaning',
    owner: 'Data managers; programmers write checks',
    artifacts: ['Edit-check output', 'Queries and resolutions', 'Reconciliation reports', 'Database lock'],
    risks: ['“Cleaning” that silently changes meaning', 'Unreconciled SAE or IxRS data', 'Fixes applied in a spreadsheet instead of the database'],
    here: [{ label: 'QC lab', to: '/learn/qc' }, { label: 'Data cleaning capstone', to: '/capstones' }],
    blurb: 'Nothing is deleted quietly: every change is a documented query resolution. That audit trail is what makes the analysis defensible.',
  },
  {
    id: 'sdtm',
    short: 'SDTM',
    title: 'SDTM tabulation datasets',
    owner: 'Statistical programmers',
    artifacts: ['DM, AE, CM, MH, EX, LB, VS, EG, DS, DV, RS, TR…', 'SUPPQUAL', 'Define-XML', 'cSDRG'],
    risks: ['Losing information in mapping', 'Inventing values not in controlled terminology', 'Broken traceability to the CRF'],
    here: [{ label: 'CDISC lab', to: '/learn/cdisc' }, { label: 'SDTM explorer', to: '/trial/sdtm' }, { label: 'SDTM datasets', to: '/data' }],
    blurb: 'SDTM organizes what was collected — it does not analyse anything. One record per observation, standard variables, standard terminology.',
  },
  {
    id: 'adam',
    short: 'ADaM',
    title: 'ADaM analysis datasets',
    owner: 'Statistical programmers, specified with biostatisticians',
    artifacts: ['ADSL, ADAE, ADLB, ADVS, ADRS, ADTTE…', 'ADaM specifications', 'ADRG'],
    risks: ['Derivations that do not match the SAP', 'Baseline or window rules applied inconsistently', 'Analysis flags that cannot be reproduced'],
    here: [{ label: 'Trace a value', to: '/trial/trace' }, { label: 'ADaM datasets', to: '/data' }],
    blurb: 'ADaM exists so an analysis is “one PROC away” and every number can be traced back to SDTM and the CRF.',
  },
  {
    id: 'analysis',
    short: 'Analysis',
    title: 'Statistical analysis',
    owner: 'Biostatisticians',
    artifacts: ['Model outputs', 'Estimates with CIs', 'Sensitivity and subgroup analyses'],
    risks: ['Model that does not match the SAP', 'Ignoring the estimand and intercurrent events', 'Over-reading p-values'],
    here: [{ label: 'Statistics lab', to: '/learn/stats' }, { label: 'Survival analysis', to: '/trial/survival' }],
    blurb: 'The analysis answers the question the protocol asked — not a slightly different question that the data made easier.',
  },
  {
    id: 'tlf',
    short: 'TLFs',
    title: 'Tables, listings & figures',
    owner: 'Statistical programmers',
    artifacts: ['Demographics, disposition, exposure, AE, lab tables', 'KM and forest plots', 'Subject listings'],
    risks: ['Wrong denominator or population', 'Counting events instead of subjects', 'Rounding and decimal inconsistencies'],
    here: [{ label: 'TLF lab', to: '/learn/tlf' }, { label: 'TLF gallery', to: '/trial/tlf' }],
    blurb: 'A table is a contract with the reader: the population, the denominator and the definition must be visible in the title and footnotes.',
  },
  {
    id: 'qc',
    short: 'QC',
    title: 'QC & validation',
    owner: 'Independent (QC) programmers and statisticians',
    artifacts: ['Independent programs', 'PROC COMPARE output', 'QC findings log', 'Sign-off'],
    risks: ['Comparing final numbers only', 'QC that copies production logic', 'Findings closed without root cause'],
    here: [{ label: 'QC lab', to: '/learn/qc' }, { label: 'QC comparisons', to: '/practice?mode=qc&count=8' }],
    blurb: 'Two people, two programs, one answer — and when they differ, the interesting work starts.',
  },
  {
    id: 'csr',
    short: 'CSR',
    title: 'Reporting & submission',
    owner: 'Medical writing, biometrics, regulatory',
    artifacts: ['Clinical study report (ICH E3)', 'Datasets + Define-XML + reviewer guides', 'Submission package'],
    risks: ['Text that overstates the result', 'Numbers in text that do not match the tables', 'Non-conformant data or missing documentation'],
    here: [{ label: 'Reviewer’s guide', to: '/documents/adrg-excerpt' }, { label: 'Regulatory concepts', to: '/learn/trials' }],
    blurb: 'Reviewers must be able to rebuild your conclusion from your data. Documentation is part of the deliverable, not an afterthought.',
  },
  {
    id: 'adhoc',
    short: 'Ad hoc',
    title: 'Ad hoc analyses & lifecycle management',
    owner: 'Everyone, usually under time pressure',
    artifacts: ['Ad hoc tables and figures', 'Advisory board requests', 'Publications', 'Integrated summaries'],
    risks: ['Untracked one-off programs', 'Results that cannot be reproduced next month', 'Multiplicity forgotten entirely'],
    here: [{ label: 'SQL workbench', to: '/sql' }, { label: 'Reproducibility lab', to: '/learn/git' }],
    blurb: 'The request that arrives at 5 pm is where reproducible habits pay for themselves.',
  },
];

export default function LifecycleMap({ props }: WidgetProps) {
  const [active, setActive] = useState(props.highlight && STAGES.some((s) => s.id === props.highlight) ? props.highlight : 'raw');
  const stage = STAGES.find((s) => s.id === active)!;
  return (
    <div className="lifecycle">
      <ol className="lifecycle__track">
        {STAGES.map((s, i) => (
          <li key={s.id}>
            <button type="button" className={clsx('lifecycle__node', s.id === active && 'is-active')} onClick={() => setActive(s.id)} aria-pressed={s.id === active}>
              <span className="lifecycle__num num">{i + 1}</span>
              <span>{s.short}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="lifecycle__detail">
        <div className="lifecycle__headline">
          <h4>{stage.title}</h4>
          <span className="muted" style={{ fontSize: 12.5 }}>
            Owner: {stage.owner}
          </span>
        </div>
        <p className="lifecycle__blurb">{stage.blurb}</p>
        <div className="lifecycle__cols">
          <div>
            <div className="eyebrow">Artifacts</div>
            <ul>
              {stage.artifacts.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="eyebrow">What goes wrong</div>
            <ul>
              {stage.risks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="eyebrow">Work on it here</div>
            <ul>
              {stage.here.map((h) => (
                <li key={h.to}>
                  <Link to={h.to}>{h.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
