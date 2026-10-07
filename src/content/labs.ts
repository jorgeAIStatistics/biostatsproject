import type { LabId, TrackId, DomainId } from './schema';

export interface LabMeta {
  id: LabId;
  title: string;
  short: string;
  description: string;
  /** Lucide icon name (resolved in components/icons.tsx). */
  icon: string;
  domains: DomainId[];
}

export const LABS: LabMeta[] = [
  {
    id: 'trials',
    title: 'Clinical Trials',
    short: 'Trials',
    description: 'How trials are designed, run and reported — protocols, randomization, endpoints, estimands, populations, safety data and regulatory deliverables.',
    icon: 'stethoscope',
    domains: ['trials', 'regulatory'],
  },
  {
    id: 'sas',
    title: 'SAS Lab',
    short: 'SAS',
    description: 'Base SAS, the DATA step, PROC SQL, macros, the SAS log, reporting and statistical procedures — the working language of clinical programming.',
    icon: 'terminal',
    domains: ['sas'],
  },
  {
    id: 'cdisc',
    title: 'CDISC Lab',
    short: 'CDISC',
    description: 'SDTM and ADaM from first principles: domains, variables, controlled terminology, derivations, traceability and Define-XML concepts.',
    icon: 'layers',
    domains: ['sdtm', 'adam', 'regulatory'],
  },
  {
    id: 'tlf',
    title: 'TLF Lab',
    short: 'TLFs',
    description: 'Tables, listings and figures: shells, denominators, summary statistics, safety and efficacy outputs, programmed from blank shells.',
    icon: 'table',
    domains: ['tlf'],
  },
  {
    id: 'stats',
    title: 'Statistics Lab',
    short: 'Statistics',
    description: 'Inference, regression, GLMs, mixed models, survival analysis and trial methods — always connected to clinical decisions.',
    icon: 'sigma',
    domains: ['stats'],
  },
  {
    id: 'r',
    title: 'R Lab',
    short: 'R',
    description: 'Modern R for clinical and biostatistical work: tidyverse data handling, modeling, survival analysis, graphics and SAS↔R translation.',
    icon: 'braces',
    domains: ['r'],
  },
  {
    id: 'python',
    title: 'Python Lab',
    short: 'Python',
    description: 'Python for analytics, validation and automation: pandas, NumPy, SciPy, statsmodels, scikit-learn, plotting and testing.',
    icon: 'code',
    domains: ['python'],
  },
  {
    id: 'sql',
    title: 'SQL Lab',
    short: 'SQL',
    description: 'Query the synthetic study database live in the browser: joins, aggregation, window functions and clinical reconciliation queries.',
    icon: 'database',
    domains: ['sql'],
  },
  {
    id: 'excel',
    title: 'Excel Lab',
    short: 'Excel',
    description: 'Excel as a serious scientific tool: clean layout, lookups, conditional aggregation, PivotTables, QC — and when code should replace it.',
    icon: 'sheet',
    domains: ['excel'],
  },
  {
    id: 'analytics',
    title: 'Analytics Lab',
    short: 'Analytics',
    description: 'Applied pharma/biotech analytics: instrument and process data, PCA, regression, regularization, cross-validation and process control.',
    icon: 'activity',
    domains: ['analytics'],
  },
  {
    id: 'qc',
    title: 'QC Lab',
    short: 'QC',
    description: 'Independent programming and discrepancy investigation: why two outputs disagree, and how to prove which one is right.',
    icon: 'shield-check',
    domains: ['qc'],
  },
  {
    id: 'git',
    title: 'Reproducibility',
    short: 'Git',
    description: 'Git, code review, testing and reproducible project structure for scientific and regulated work.',
    icon: 'git-branch',
    domains: ['repro'],
  },
];

export const LAB_BY_ID = Object.fromEntries(LABS.map((l) => [l.id, l])) as Record<LabId, LabMeta>;

export const TRACKS: { id: TrackId; title: string; description: string }[] = [
  { id: 'programmer', title: 'Clinical Statistical Programmer', description: 'SAS, CDISC SDTM/ADaM, TLFs, QC and submission concepts.' },
  { id: 'biostatistician', title: 'Clinical Biostatistician', description: 'Design, estimands, models, survival, missing data, SAPs and interpretation.' },
  { id: 'analytics', title: 'Pharma / Biotech Analytics', description: 'Process and instrument data, PCA, regression, prediction, automation.' },
  { id: 'computing', title: 'Modern Statistical Computing', description: 'R, Python, SQL, Git, testing and reproducibility.' },
  { id: 'excel', title: 'Excel for Scientists', description: 'Spreadsheets used deliberately — and replaced by code when needed.' },
];

export const DOMAINS: { id: DomainId; title: string; short: string }[] = [
  { id: 'sas', title: 'SAS', short: 'SAS' },
  { id: 'r', title: 'R', short: 'R' },
  { id: 'python', title: 'Python', short: 'Python' },
  { id: 'sql', title: 'SQL', short: 'SQL' },
  { id: 'excel', title: 'Excel', short: 'Excel' },
  { id: 'stats', title: 'Statistics', short: 'Stats' },
  { id: 'trials', title: 'Clinical Trials', short: 'Trials' },
  { id: 'sdtm', title: 'SDTM', short: 'SDTM' },
  { id: 'adam', title: 'ADaM', short: 'ADaM' },
  { id: 'tlf', title: 'TLFs', short: 'TLFs' },
  { id: 'qc', title: 'QC & Validation', short: 'QC' },
  { id: 'regulatory', title: 'Regulatory Concepts', short: 'Regulatory' },
  { id: 'communication', title: 'Communication', short: 'Comms' },
  { id: 'analytics', title: 'Industrial Analytics', short: 'Analytics' },
  { id: 'repro', title: 'Reproducibility & Git', short: 'Repro' },
];

export const DOMAIN_BY_ID = Object.fromEntries(DOMAINS.map((d) => [d.id, d])) as Record<DomainId, (typeof DOMAINS)[number]>;

/** Career roles and how much each competency domain matters for them (weights sum to 1). */
export const ROLES: { id: string; title: string; weights: Partial<Record<DomainId, number>> }[] = [
  {
    id: 'stat-programmer',
    title: 'Statistical Programmer',
    weights: { sas: 0.24, sdtm: 0.14, adam: 0.16, tlf: 0.14, qc: 0.1, trials: 0.06, regulatory: 0.05, r: 0.05, sql: 0.03, communication: 0.03 },
  },
  {
    id: 'biostatistician',
    title: 'Biostatistician',
    weights: { stats: 0.34, trials: 0.14, r: 0.12, sas: 0.1, adam: 0.05, tlf: 0.05, communication: 0.12, regulatory: 0.04, qc: 0.04 },
  },
  {
    id: 'clinical-data-scientist',
    title: 'Clinical Data Scientist',
    weights: { python: 0.16, r: 0.12, sql: 0.14, stats: 0.14, sdtm: 0.08, adam: 0.06, trials: 0.08, qc: 0.08, communication: 0.08, repro: 0.06 },
  },
  {
    id: 'biotech-analyst',
    title: 'Biotech Data Analyst',
    weights: { python: 0.2, analytics: 0.24, stats: 0.14, excel: 0.1, sql: 0.1, repro: 0.1, communication: 0.12 },
  },
];
