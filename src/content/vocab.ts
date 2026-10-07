/**
 * Shared content vocabularies and lesson conventions.
 *
 * This module has no dependencies so the browser bundle can use it; the zod
 * schemas in schema.ts build on it and re-export everything.
 */

export const LAB_IDS = [
  'trials', // Clinical trial fundamentals + documents
  'sas',
  'cdisc', // SDTM + ADaM
  'tlf',
  'stats',
  'r',
  'python',
  'sql',
  'excel',
  'analytics', // Applied pharma / manufacturing analytics, PCA, regression, ML
  'qc',
  'git', // Git, reproducibility, testing, code review
] as const;

export const TRACK_IDS = ['programmer', 'biostatistician', 'analytics', 'computing', 'excel'] as const;

export const DIFFICULTIES = ['foundation', 'intermediate', 'advanced', 'expert'] as const;

/** Competency domains used by the skill matrix and career-readiness model. */
export const DOMAIN_IDS = [
  'sas',
  'r',
  'python',
  'sql',
  'excel',
  'stats',
  'trials',
  'sdtm',
  'adam',
  'tlf',
  'qc',
  'regulatory',
  'communication',
  'analytics',
  'repro',
] as const;

/** Learning modes an item can be used in. */
export const MODE_IDS = [
  'check', // knowledge check embedded in a lesson
  'guided', // guided practice: progressive hints expected
  'independent', // minimal assistance; hints cost mastery credit
  'debug', // find and fix broken code / tables / interpretations
  'qc', // two outputs disagree: find out why
  'interview', // realistic interview question, answer withheld
  'speed', // short recognition / syntax drill
  'case', // step inside a multi-step case study
  'boss', // difficult integrated exercise
] as const;

export const ITEM_FORMATS = [
  'mcq',
  'multi',
  'numeric',
  'text',
  'mapping',
  'order',
  'classify',
  'code',
  'sql',
  'log',
  'hotspot',
  'diff',
  'open',
] as const;

export const CODE_LANGUAGES = ['sas', 'r', 'python', 'sql'] as const;

/** SQLite databases available to `sql` items and the SQL workbench. */
export const SQL_DATABASES = ['oncology', 'cardio', 'manufacturing'] as const;

export const STANDARD_KINDS = ['official', 'convention', 'simplification'] as const;

export const REFERENCE_CATEGORIES = [
  'sas-syntax',
  'sas-procs',
  'r-functions',
  'pandas',
  'sql',
  'excel',
  'git',
  'distributions',
  'tests',
  'trial-terms',
  'sdtm-domains',
  'adam-variables',
  'abbreviations',
  'endpoints',
  'survival',
  'regulatory',
] as const;

export const DOCUMENT_TYPES = [
  'protocol',
  'crf',
  'acrf',
  'dmp',
  'sap',
  'shells',
  'sdtm-spec',
  'adam-spec',
  'adrg',
  'csr',
] as const;

/** Functions implemented by the in-browser formula engine (src/lib/excel). */
export const EXCEL_FUNCTIONS = [
  'SUM', 'AVERAGE', 'MIN', 'MAX', 'MEDIAN', 'COUNT', 'COUNTA', 'COUNTBLANK', 'ROUND', 'ROUNDUP', 'ROUNDDOWN',
  'ABS', 'INT', 'MOD', 'SQRT', 'POWER', 'STDEV.S', 'STDEV', 'VAR.S',
  'COUNTIF', 'COUNTIFS', 'SUMIF', 'SUMIFS', 'AVERAGEIF', 'AVERAGEIFS', 'MAXIFS', 'MINIFS',
  'IF', 'IFS', 'AND', 'OR', 'NOT', 'IFERROR', 'IFNA', 'ISBLANK', 'ISNUMBER', 'ISTEXT', 'ISERROR',
  'XLOOKUP', 'VLOOKUP', 'INDEX', 'MATCH',
  'LEFT', 'RIGHT', 'MID', 'LEN', 'TRIM', 'UPPER', 'LOWER', 'PROPER', 'CONCAT', 'CONCATENATE', 'TEXTJOIN',
  'SUBSTITUTE', 'FIND', 'SEARCH', 'VALUE', 'TEXT', 'EXACT',
  'DATE', 'YEAR', 'MONTH', 'DAY', 'DATEDIF', 'EDATE', 'EOMONTH', 'DATEVALUE', 'WEEKDAY',
] as const;

/** Canonical lesson sections, in order. H2 headings are matched case-insensitively. */
export const LESSON_SECTIONS = [
  { kind: 'problem', headings: ['What problem are we trying to solve?'], required: true },
  { kind: 'intuition', headings: ['Intuition'], required: true },
  { kind: 'context', headings: ['Clinical context', 'Industry context'], required: true },
  { kind: 'formal', headings: ['Formal concept'], required: false },
  { kind: 'worked', headings: ['Worked example'], required: true },
  { kind: 'data', headings: ['Data example'], required: false },
  { kind: 'code', headings: ['Code'], required: false },
  { kind: 'output', headings: ['Output'], required: false },
  { kind: 'interpretation', headings: ['Interpretation'], required: false },
  { kind: 'mistakes', headings: ['Common mistakes'], required: true },
  { kind: 'check', headings: ['Knowledge check'], required: true },
  { kind: 'exercise', headings: ['Hands-on exercise'], required: true },
  { kind: 'challenge', headings: ['Challenge exercise'], required: false },
  { kind: 'industry', headings: ['Industry note'], required: true },
] as const;

/** Container directives: `:::name[optional label]{attrs}` … `:::` */
export const CONTAINER_DIRECTIVES = {
  // Collapsible explanations (collapsed by default)
  why: { label: 'required', defaultLabel: 'Why?' },
  number: { label: 'required', defaultLabel: 'Where did this number come from?' },
  line: { label: 'required', defaultLabel: 'Explain this line' },
  intuition: { label: 'optional', defaultLabel: 'Show intuition' },
  math: { label: 'optional', defaultLabel: 'Show mathematics' },
  clinical: { label: 'optional', defaultLabel: 'Show clinical interpretation' },
  interview: { label: 'optional', defaultLabel: 'Common interview question' },
  mistake: { label: 'optional', defaultLabel: 'Common mistake' },
  deeper: { label: 'required', defaultLabel: 'Go deeper' },
  // Visible callouts
  note: { label: 'optional', defaultLabel: 'Note' },
  tip: { label: 'optional', defaultLabel: 'Tip' },
  warning: { label: 'optional', defaultLabel: 'Warning' },
  industry: { label: 'optional', defaultLabel: 'Industry note' },
  ai: { label: 'optional', defaultLabel: 'AI-assisted work' },
  standard: { label: 'optional', defaultLabel: 'Standards' },
  // Structure
  lines: { label: 'none', defaultLabel: '' },
  tabs: { label: 'none', defaultLabel: '' },
  tab: { label: 'required', defaultLabel: '' },
  columns: { label: 'none', defaultLabel: '' },
  col: { label: 'optional', defaultLabel: '' },
} as const;
export type ContainerDirectiveName = keyof typeof CONTAINER_DIRECTIVES;

/** Leaf directives (embeds): `::name{attrs}` on their own line. */
export const LEAF_DIRECTIVES = {
  dataset: { required: ['id'], optional: ['cols', 'rows', 'filter', 'sort', 'caption'] },
  quiz: { required: ['ids'], optional: [] },
  practice: { required: ['ids'], optional: ['title', 'mode'] },
  widget: { required: ['name'], optional: ['*'] },
  doc: { required: ['id'], optional: ['section', 'label'] },
  lesson: { required: ['id'], optional: ['label'] },
  crosswalk: { required: ['id'], optional: [] },
} as const;
export type LeafDirectiveName = keyof typeof LEAF_DIRECTIVES;

/** Text directives: `:name[label]{attrs}` inline. */
export const TEXT_DIRECTIVES = {
  kbd: {},
  term: {}, // :term[TEAE]{id="teae"} → glossary tooltip (reference entry id)
  var: {}, // :var[TRT01P] → styled variable name
} as const;

/** Languages allowed on fenced code blocks in lessons. */
export const FENCE_LANGUAGES = [
  'sas',
  'r',
  'python',
  'sql',
  'bash',
  'yaml',
  'json',
  'csv',
  'text',
  'output', // SAS/R listing-style output
  'log', // SAS log (ERROR/WARNING/NOTE colouring)
  'excel', // spreadsheet formulas
  'diff',
  'xml',
] as const;

export type LabId = (typeof LAB_IDS)[number];
export type TrackId = (typeof TRACK_IDS)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type DomainId = (typeof DOMAIN_IDS)[number];
export type ModeId = (typeof MODE_IDS)[number];
export type ItemFormat = (typeof ITEM_FORMATS)[number];
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];
export type SqlDatabase = (typeof SQL_DATABASES)[number];
export type ReferenceCategory = (typeof REFERENCE_CATEGORIES)[number];
export type LessonSectionKind = (typeof LESSON_SECTIONS)[number]['kind'];
