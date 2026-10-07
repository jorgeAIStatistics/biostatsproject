/**
 * Content schema — the single contract between curriculum authors and the UI.
 *
 * Every YAML file under /content is validated against these schemas by
 * `npm run validate` (scripts/validate-content.ts) and by the unit tests.
 * The app imports only the *types* from this module (`import type`), so zod
 * never ships to the browser bundle.
 *
 * See CONTENT_GUIDE.md for authoring conventions and examples.
 */
import { z } from 'zod';
import {
  LAB_IDS,
  TRACK_IDS,
  DIFFICULTIES,
  DOMAIN_IDS,
  MODE_IDS,
  CODE_LANGUAGES,
  SQL_DATABASES,
  STANDARD_KINDS,
  REFERENCE_CATEGORIES,
  DOCUMENT_TYPES,
} from './vocab';
import type { ItemFormat } from './vocab';
export * from './vocab';

/* ------------------------------------------------------------------ */
/* Shared vocabularies                                                  */
/* ------------------------------------------------------------------ */










/* ------------------------------------------------------------------ */
/* Primitive helpers                                                    */
/* ------------------------------------------------------------------ */

/** Lesson / module / item ids: lowercase, digits, dots and hyphens. */
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, 'ids must be lowercase letters/digits separated by "-" or "."');

/** Skill ids are namespaced by domain, e.g. `sas.merge`, `stats.cox-ph`. */
export const skillId = z
  .string()
  .regex(/^[a-z]+\.[a-z0-9]+(?:-[a-z0-9]+)*$/, 'skill ids look like "<domain>.<kebab-name>", e.g. "sas.merge"');

/** Markdown text. May include inline math ($...$), code spans, links. */
const md = z.string().min(1);

/* ------------------------------------------------------------------ */
/* Skills                                                               */
/* ------------------------------------------------------------------ */

export const SkillSchema = z.strictObject({
  id: skillId,
  name: z.string().min(3),
  description: z.string().min(10),
  /** 1 = supporting, 2 = core, 3 = critical for employability. */
  weight: z.number().int().min(1).max(3).default(2),
  tracks: z.array(z.enum(TRACK_IDS)).min(1),
});
export type Skill = z.infer<typeof SkillSchema>;

export const SkillFileSchema = z.strictObject({
  domain: z.enum(DOMAIN_IDS),
  title: z.string(),
  description: z.string(),
  skills: z.array(SkillSchema).min(1),
});
export type SkillFile = z.infer<typeof SkillFileSchema>;

/* ------------------------------------------------------------------ */
/* Curriculum                                                           */
/* ------------------------------------------------------------------ */

export const LessonMetaSchema = z.strictObject({
  id: slug,
  title: z.string().min(3),
  summary: z.string().min(10),
  minutes: z.number().int().min(5).max(240),
  difficulty: z.enum(DIFFICULTIES),
  tracks: z.array(z.enum(TRACK_IDS)).min(1),
  skills: z.array(skillId).min(1),
  prerequisites: z.array(slug).default([]),
  /** Keywords that help search (synonyms, acronyms). */
  keywords: z.array(z.string()).default([]),
});
export type LessonMeta = z.infer<typeof LessonMetaSchema>;

export const ModuleSchema = z.strictObject({
  id: slug,
  title: z.string().min(3),
  summary: z.string().min(10),
  /** Rough position in the 18–24 month journey (1 = first months, 5 = final months). */
  level: z.number().int().min(1).max(5),
  lessons: z.array(LessonMetaSchema).min(1),
});
export type Module = z.infer<typeof ModuleSchema>;

export const CurriculumFileSchema = z.strictObject({
  lab: z.enum(LAB_IDS),
  modules: z.array(ModuleSchema).min(1),
});
export type CurriculumFile = z.infer<typeof CurriculumFileSchema>;

/* ------------------------------------------------------------------ */
/* Practice items (questions, exercises, drills, interview questions)   */
/* ------------------------------------------------------------------ */

/**
 * The explanation engine. For challenging items (advanced/expert, debug, qc,
 * boss) authors should answer these explicitly instead of dumping a formula.
 */
export const ExplanationSchema = z.strictObject({
  objective: md.optional(), // What is the objective?
  given: md.optional(), // What information was provided?
  relevant: md.optional(), // What information matters?
  irrelevant: md.optional(), // What information does not matter?
  calculating: md.optional(), // What are we calculating?
  method: md.optional(), // Why are we using this method?
  numbers: md.optional(), // Where does each number come from?
  assumptions: md.optional(), // What assumptions are being made?
  computation: md.optional(), // How do we compute the result?
  interpretation: md.optional(), // How should we interpret it?
  changes: md.optional(), // What would change the answer?
  interviewer: md.optional(), // What would an interviewer expect me to understand?
});
export type Explanation = z.infer<typeof ExplanationSchema>;

const itemBase = {
  id: slug,
  modes: z.array(z.enum(MODE_IDS)).min(1),
  difficulty: z.enum(DIFFICULTIES),
  skills: z.array(skillId).min(1),
  /** Short label used in lists (defaults to the first line of the prompt). */
  title: z.string().optional(),
  prompt: md,
  /** Progressive hints, weakest first. */
  hints: z.array(md).default([]),
  /** Worked solution shown after an attempt (markdown, may include code). */
  solution: md.optional(),
  explanation: ExplanationSchema.optional(),
  /** Lesson this item belongs to (enables "back to lesson" links). */
  lesson: slug.optional(),
  /** Dataset ids (e.g. "oncology/sdtm/dm") shown as context drawers. */
  datasets: z.array(z.string()).default([]),
  /** Estimated minutes to complete. */
  minutes: z.number().min(0.25).max(240).optional(),
  tags: z.array(z.string()).default([]),
};

const choice = z.strictObject({
  text: md,
  correct: z.boolean().default(false),
  /** Shown after answering: why this option is right or wrong. */
  feedback: md.optional(),
});

const tableData = z.strictObject({
  title: z.string(),
  columns: z.array(z.string()).min(1),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))).min(1),
  footnote: z.string().optional(),
});

const lineNote = z.strictObject({ line: z.number().int().min(1), note: md });

export const McqItemSchema = z.strictObject({
  ...itemBase,
  format: z.literal('mcq'),
  choices: z.array(choice).min(2),
  shuffle: z.boolean().default(true),
});

export const MultiItemSchema = z.strictObject({
  ...itemBase,
  format: z.literal('multi'),
  choices: z.array(choice).min(2),
  shuffle: z.boolean().default(true),
});

export const NumericItemSchema = z.strictObject({
  ...itemBase,
  format: z.literal('numeric'),
  answer: z.number(),
  /** Absolute tolerance. Use it to accept reasonable rounding. */
  tolerance: z.number().min(0).default(0),
  unit: z.string().optional(),
});

export const TextItemSchema = z.strictObject({
  ...itemBase,
  format: z.literal('text'),
  /** Accepted answers, compared case-insensitively after trimming/collapsing spaces. */
  accept: z.array(z.string()).min(1),
  /** Optional regular expressions (JavaScript syntax, case-insensitive). */
  acceptPatterns: z.array(z.string()).default([]),
  placeholder: z.string().optional(),
  monospace: z.boolean().default(false),
});

export const MappingItemSchema = z.strictObject({
  ...itemBase,
  format: z.literal('mapping'),
  /** Each source value must be mapped to its target. */
  pairs: z.array(z.strictObject({ source: z.string(), target: z.string(), note: md.optional() })).min(2),
  /** Options offered for every source (defaults to the unique targets). Include distractors here. */
  targets: z.array(z.string()).optional(),
  sourceLabel: z.string().default('Source'),
  targetLabel: z.string().default('Target'),
});

export const OrderItemSchema = z.strictObject({
  ...itemBase,
  format: z.literal('order'),
  /** Steps in the CORRECT order; they are shuffled for the learner. */
  steps: z.array(md).min(3),
});

export const ClassifyItemSchema = z.strictObject({
  ...itemBase,
  format: z.literal('classify'),
  categories: z.array(z.string()).min(2),
  entries: z.array(z.strictObject({ text: md, category: z.string(), note: md.optional() })).min(2),
});

const codeCheck = z.strictObject({
  /** JavaScript regular expression tested against the learner's code (comments stripped). */
  pattern: z.string(),
  flags: z.string().default('i'),
  /** true = the pattern must NOT appear (e.g. a known anti-pattern). */
  absent: z.boolean().default(false),
  /** What the requirement is, phrased for the learner. */
  message: z.string(),
});

export const CodeItemSchema = z.strictObject({
  ...itemBase,
  format: z.literal('code'),
  language: z.enum(CODE_LANGUAGES),
  starter: z.string().default(''),
  /** Structural checks. SAS/R are never executed in the browser — checks are syntax-aware only. */
  checks: z.array(codeCheck).min(1),
  /** Reference solution code. */
  reference: z.string(),
  /** Expected output / log excerpt (static; produced independently of browser execution). */
  expectedOutput: z.string().optional(),
  /** For python items: allow optional in-browser execution via Pyodide. */
  runnable: z.boolean().default(false),
  /** For runnable python items: assertion code appended after the learner's code. */
  tests: z.string().optional(),
});

export const SqlItemSchema = z.strictObject({
  ...itemBase,
  format: z.literal('sql'),
  db: z.enum(SQL_DATABASES),
  starter: z.string().default(''),
  /** Reference query. The learner's result set is compared with this query's result set. */
  reference: z.string(),
  orderMatters: z.boolean().default(false),
  /** Compare column names too (default compares values only). */
  compareColumns: z.boolean().default(false),
});

export const LogItemSchema = z.strictObject({
  ...itemBase,
  format: z.literal('log'),
  /** SAS log text. Learners click the lines that indicate a problem. */
  log: z.string(),
  /** 1-based line numbers (within `log`) that the learner should flag. */
  issues: z.array(z.number().int().min(1)).min(1),
  lineNotes: z.array(lineNote).default([]),
  /** Optional program that produced the log. */
  program: z.string().optional(),
});

export const HotspotItemSchema = z.strictObject({
  ...itemBase,
  format: z.literal('hotspot'),
  language: z.enum([...CODE_LANGUAGES, 'text'] as const),
  code: z.string(),
  /** 1-based line numbers containing the defect(s). */
  answerLines: z.array(z.number().int().min(1)).min(1),
  lineNotes: z.array(lineNote).default([]),
  /** Optional corrected code shown after the attempt. */
  fixed: z.string().optional(),
});

export const DiffItemSchema = z.strictObject({
  ...itemBase,
  format: z.literal('diff'),
  left: tableData,
  right: tableData,
  /** Optional programs behind each output. */
  leftCode: z.string().optional(),
  rightCode: z.string().optional(),
  codeLanguage: z.enum(CODE_LANGUAGES).optional(),
  /** Root-cause options (one or more correct). */
  choices: z.array(choice).min(2),
});

export const OpenItemSchema = z.strictObject({
  ...itemBase,
  format: z.literal('open'),
  /** A strong model answer. */
  modelAnswer: md,
  /** Points an interviewer listens for — used for self-assessment. */
  rubric: z.array(z.string()).min(2),
  /** Common weak answers / red flags. */
  redFlags: z.array(z.string()).default([]),
  followUps: z.array(z.string()).default([]),
});

export const ItemSchema = z.discriminatedUnion('format', [
  McqItemSchema,
  MultiItemSchema,
  NumericItemSchema,
  TextItemSchema,
  MappingItemSchema,
  OrderItemSchema,
  ClassifyItemSchema,
  CodeItemSchema,
  SqlItemSchema,
  LogItemSchema,
  HotspotItemSchema,
  DiffItemSchema,
  OpenItemSchema,
]);
export type Item = z.infer<typeof ItemSchema>;
export type ItemOf<F extends ItemFormat> = Extract<Item, { format: F }>;

export const ItemFileSchema = z.strictObject({
  items: z.array(ItemSchema).min(1),
});

/* ------------------------------------------------------------------ */
/* Reference library                                                    */
/* ------------------------------------------------------------------ */


export const ReferenceEntrySchema = z.strictObject({
  id: slug,
  term: z.string(),
  aliases: z.array(z.string()).default([]),
  /** One-sentence definition. */
  summary: md,
  /** Longer explanation (markdown). */
  body: md.optional(),
  /** Syntax template or signature. */
  syntax: z.string().optional(),
  example: z.string().optional(),
  language: z.enum(['sas', 'r', 'python', 'sql', 'excel', 'bash', 'text']).optional(),
  /** Related reference entry ids or lesson ids. */
  related: z.array(z.string()).default([]),
  /** Official / convention / simplification label for standards content. */
  standard: z.enum(STANDARD_KINDS).optional(),
  source: z.strictObject({ label: z.string(), url: z.string().url().optional() }).optional(),
});
export type ReferenceEntry = z.infer<typeof ReferenceEntrySchema>;

export const ReferenceFileSchema = z.strictObject({
  category: z.enum(REFERENCE_CATEGORIES),
  title: z.string(),
  description: z.string(),
  entries: z.array(ReferenceEntrySchema).min(1),
});

/* ------------------------------------------------------------------ */
/* Code crosswalk                                                       */
/* ------------------------------------------------------------------ */

const impl = z.strictObject({
  code: z.string(),
  /** Language-specific notes: defaults, gotchas, what the code assumes. */
  notes: md.optional(),
});

export const CrosswalkTaskSchema = z.strictObject({
  id: slug,
  title: z.string(),
  category: z.enum(['data', 'reshape', 'derivation', 'summary', 'model', 'io', 'qc']),
  summary: md,
  skills: z.array(skillId).default([]),
  dataset: z.string().optional(),
  sas: impl.optional(),
  r: impl.optional(),
  python: impl.optional(),
  sql: impl.optional(),
  /** The important part: semantic differences between the implementations. */
  semantics: md,
  pitfalls: z.array(md).default([]),
});
export type CrosswalkTask = z.infer<typeof CrosswalkTaskSchema>;

export const CrosswalkFileSchema = z.strictObject({ tasks: z.array(CrosswalkTaskSchema).min(1) });

/* ------------------------------------------------------------------ */
/* MS Companion                                                         */
/* ------------------------------------------------------------------ */

export const CompanionTopicSchema = z.strictObject({
  id: slug,
  title: z.string(),
  course: z.enum([
    'probability',
    'inference',
    'regression',
    'categorical',
    'survival',
    'longitudinal',
    'clinical-trials',
    'design',
    'computing',
  ]),
  academic: md,
  industry: md,
  clinicalExample: md,
  sas: z.string(),
  r: z.string(),
  python: z.string().optional(),
  interview: z.strictObject({ question: md, answer: md }),
  lessons: z.array(slug).default([]),
  skills: z.array(skillId).default([]),
});
export type CompanionTopic = z.infer<typeof CompanionTopicSchema>;

export const CompanionFileSchema = z.strictObject({ topics: z.array(CompanionTopicSchema).min(1) });

/* ------------------------------------------------------------------ */
/* Case studies & capstones                                             */
/* ------------------------------------------------------------------ */

const projectStep = z.strictObject({
  id: slug,
  title: z.string(),
  body: md,
  /** Practice item ids that verify this step. */
  items: z.array(slug).default([]),
  /** What "done" looks like for this step. */
  done: md.optional(),
});

export const CaseStudySchema = z.strictObject({
  id: slug,
  title: z.string(),
  summary: z.string(),
  difficulty: z.enum(DIFFICULTIES),
  minutes: z.number().int().min(10),
  labs: z.array(z.enum(LAB_IDS)).min(1),
  skills: z.array(skillId).min(1),
  datasets: z.array(z.string()).default([]),
  scenario: md,
  steps: z.array(projectStep).min(2),
  debrief: md,
});
export type CaseStudy = z.infer<typeof CaseStudySchema>;

export const CaseFileSchema = z.strictObject({ cases: z.array(CaseStudySchema).min(1) });

export const CapstoneSchema = z.strictObject({
  id: slug,
  number: z.number().int().min(1),
  title: z.string(),
  summary: z.string(),
  difficulty: z.enum(DIFFICULTIES),
  hours: z.number().min(1),
  skills: z.array(skillId).min(1),
  datasets: z.array(z.string()).default([]),
  objective: md,
  /** Why this project matters to employers (accurate, no hype). */
  relevance: md,
  deliverables: z.array(md).min(1),
  steps: z.array(projectStep).min(3),
  rubric: z.array(z.strictObject({ criterion: z.string(), description: md })).min(3),
  /** Folder in the repository with starter files, e.g. "capstones/01-clinical-data-cleaner". */
  starter: z.string().optional(),
  portfolio: z.strictObject({
    repoName: z.string(),
    /** Accurate one-line description. No "FDA-ready" or "certified" claims. */
    tagline: z.string(),
    methods: md,
    limitations: md,
  }),
});
export type Capstone = z.infer<typeof CapstoneSchema>;

export const CapstoneFileSchema = z.strictObject({ capstones: z.array(CapstoneSchema).min(1) });

/* ------------------------------------------------------------------ */
/* Clinical documents                                                   */
/* ------------------------------------------------------------------ */


export const DocumentMetaSchema = z.strictObject({
  id: slug,
  title: z.string(),
  type: z.enum(DOCUMENT_TYPES),
  summary: z.string(),
  /** Markdown body file relative to content/documents/. */
  file: z.string(),
  /** Practice items that ask the learner to interpret this document. */
  items: z.array(slug).default([]),
  version: z.string().optional(),
});
export type DocumentMeta = z.infer<typeof DocumentMetaSchema>;

export const DocumentIndexSchema = z.strictObject({ documents: z.array(DocumentMetaSchema).min(1) });

/* ------------------------------------------------------------------ */
/* Spreadsheet sandbox sheets (Excel lab)                               */
/* ------------------------------------------------------------------ */


const cellValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const SheetSchema = z.strictObject({
  id: slug,
  title: z.string(),
  description: md,
  /** Header labels for row 1; columns are lettered A, B, C … in order. */
  columns: z.array(z.string()).min(1),
  /** Data rows starting at spreadsheet row 2. A string starting with "=" is a formula. */
  rows: z.array(z.array(cellValue)).min(1),
  /** Number format hints by column letter, e.g. { D: "0.0", E: "yyyy-mm-dd" }. */
  formats: z.record(z.string(), z.string()).default({}),
  /** Guided tasks: the learner types a formula into `cell`; the result is compared to `expected`. */
  tasks: z
    .array(
      z.strictObject({
        prompt: md,
        cell: z.string().regex(/^[A-Z]{1,2}[0-9]{1,4}$/),
        expected: z.union([z.string(), z.number(), z.boolean()]),
        tolerance: z.number().min(0).default(0),
        hint: md.optional(),
        /** A formula that produces `expected` (shown after the attempt). */
        solution: z.string().regex(/^=/),
      }),
    )
    .default([]),
});
export type Sheet = z.infer<typeof SheetSchema>;

export const SheetFileSchema = z.strictObject({ sheets: z.array(SheetSchema).min(1) });

/* ------------------------------------------------------------------ */
/* Official sources                                                     */
/* ------------------------------------------------------------------ */

export const SourceSchema = z.strictObject({
  id: slug,
  title: z.string(),
  org: z.enum(['FDA', 'CDISC', 'ICH', 'NCI', 'EMA', 'PHUSE', 'WHO', 'Academic', 'Software']),
  url: z.string().url(),
  version: z.string().optional(),
  /** What the source is and what this app uses it for. */
  note: md,
  topics: z.array(z.string()).default([]),
});
export type Source = z.infer<typeof SourceSchema>;

export const SourceFileSchema = z.strictObject({ sources: z.array(SourceSchema).min(1) });

/* ------------------------------------------------------------------ */
/* Dataset manifests (written by the data generators)                   */
/* ------------------------------------------------------------------ */

export const DatasetColumnSchema = z.strictObject({
  name: z.string(),
  label: z.string(),
  type: z.enum(['char', 'num', 'date', 'datetime']),
  /** SDTM role / ADaM category, e.g. "Identifier", "Topic", "Timing". */
  role: z.string().optional(),
  /** Origin: Collected, Derived, Assigned, Protocol, Predecessor, Sponsor … */
  origin: z.string().optional(),
  codelist: z.string().optional(),
  /** How the value is derived (markdown). */
  derivation: z.string().optional(),
  notes: z.string().optional(),
});

export const DatasetMetaSchema = z.strictObject({
  /** "<study>/<layer>/<name>", e.g. "oncology/sdtm/dm". */
  id: z.string(),
  layer: z.enum(['raw', 'sdtm', 'adam', 'teaching', 'process', 'messy', 'reference']),
  name: z.string(),
  label: z.string(),
  /** File path relative to the study folder, e.g. "sdtm/dm.csv". */
  file: z.string(),
  rows: z.number().int().min(0),
  keys: z.array(z.string()).default([]),
  /** Observation class / structure, e.g. "Events", "BDS", "OCCDS", "One record per subject". */
  structure: z.string().optional(),
  description: z.string(),
  columns: z.array(DatasetColumnSchema).min(1),
});
export type DatasetMeta = z.infer<typeof DatasetMetaSchema>;

export const DatasetManifestSchema = z.strictObject({
  study: z.string(),
  title: z.string(),
  description: z.string(),
  /** Always true: every dataset in this project is synthetic. */
  synthetic: z.literal(true),
  generator: z.string(),
  seed: z.union([z.number(), z.string()]),
  datasets: z.array(DatasetMetaSchema).min(1),
});
export type DatasetManifest = z.infer<typeof DatasetManifestSchema>;

/* ------------------------------------------------------------------ */
/* Lesson markdown conventions (validated by scripts/validate-content)  */
/* ------------------------------------------------------------------ */


