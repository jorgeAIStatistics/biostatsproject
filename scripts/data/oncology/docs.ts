/**
 * data/oncology/README.md and data/oncology/answer-key/README.md.
 */
import type { Table } from './csv.ts';
import type { RawResult } from './raw.ts';
import type { Truth } from './truth.ts';

const fmt = (n: number) => n.toLocaleString('en-US');

export function datasetReadme(i: { seed: number; raw: Table[]; sdtm: Table[]; adam: Table[]; truth: Truth; rawResult: RawResult }): string {
  const rows = (ts: Table[]) => ts.map((t) => `| \`${t.name}\` | ${fmt(t.rows.length)} | ${t.columns.length} |`).join('\n');
  const rnd = i.truth.subjects.filter((s) => !s.screenFail);
  const treated = rnd.filter((s) => s.treated).length;
  return `# CBX417-301 — synthetic oncology dataset

**Everything in this folder is synthetic and fictional.** No real subjects, investigators, sites, sponsors or
products are represented, and there is no PHI. CBX-417 and Halden Therapeutics do not exist.

A Phase 2/3, randomized, double-blind, placebo-controlled study of CBX-417 + docetaxel versus placebo + docetaxel
in previously treated advanced or metastatic NSCLC. ${fmt(i.truth.subjects.length)} subjects screened,
${fmt(rnd.length)} randomized 1:1, ${fmt(treated)} treated, data cutoff **2025-03-31** (final PFS analysis).
The design contract is \`docs/specs/oncology-study-spec.md\`; computed results are in \`STUDY_FACTS.md\`.

## Layers

| Folder | What it is | How to use it |
|---|---|---|
| \`raw/\` | EDC and vendor exports *before* data management finished: EDC text dates (\`07 MAR 2023\`), partial dates (\`UN MAR 2023\`), vendor lab codes, wide vital-sign form, kit numbers, site-specific coding — and the injected data problems | Data-cleaning, mapping and SDTM-building practice |
| \`sdtm/\` | SDTMIG v3.4-style domains built from the **corrected** data (as if every query had been resolved) | SDTM study, define-style metadata, SQL |
| \`adam/\` | ADaMIG v1.3-style analysis datasets derived **from SDTM** | Analysis, TLFs, statistics |
| \`answer-key/\` | Every injected problem, how it was resolved, and the corrected value | Check your cleaning — do not read it first |
| \`lineage/\` | \`sdtm_raw_map.csv\`: every SDTM record → the raw row(s) behind it | "Trace this value" exercises |
| \`cbx417.sqlite\` | All SDTM and ADaM tables (lowercase names) | SQL lab |
| \`manifest.json\` | Machine-readable data dictionary: every dataset, every column, labels, roles, origins, codelists, derivations | The app's dataset viewer; your reference |

## Datasets

### Raw (EDC / vendor)

| File | Rows | Columns |
|---|---|---|
${rows(i.raw)}

### SDTM

| Domain | Rows | Columns |
|---|---|---|
${rows(i.sdtm)}

### ADaM

| Dataset | Rows | Columns |
|---|---|---|
${rows(i.adam)}

## File conventions

- UTF-8 without BOM, comma-delimited, LF line endings, one header row, RFC 4180 quoting when needed.
- An empty field means missing. There are no "." or "NA" placeholders.
- SDTM/ADaM dates are ISO 8601 text (\`2023-03-07\`, or \`2023-03-07T08:15\` where a time is collected);
  partial dates keep reduced precision (\`2019-03\`, \`2019\`). In SAS these would be numeric dates with a
  DATE9. format and separate \`--DTC\` character variables — here everything is text.
- Numbers carry no thousands separators. Laboratory results keep the precision the laboratory reported;
  converted results are rounded one decimal beyond the SI reporting precision; BMI 1 decimal, BSA 2 decimals,
  percent change 2 decimals.
- Study day (\`--DY\`, \`ADY\`) has **no day 0**: the reference day is day 1 and the day before it is day −1.

## Raw → SDTM mapping notes

- Visit names differ by source: EDC forms use \`Screening\`, \`Cycle 3 Day 1\`, \`End of Treatment\`;
  the laboratory vendor uses \`SCRN\`, \`C3D1\`, \`EOT\`, \`SFU\`, \`UNSCHED\`; imaging uses \`Baseline\`, \`Week 12\`.
  SDTM uses the protocol visit names (\`SCREENING\`, \`CYCLE 3 DAY 1\`, \`WEEK 12\`, …).
- Laboratory vendor test codes (\`CH010\`, \`HE010\`, \`L-TBIL\`, …) are *not* CDISC LBTESTCD — map them.
- The kit list is the only link between a subject and the treatment actually received (blinded study).
- ECOG performance status is collected on the vital-signs form and maps to **RS** (\`RSCAT = ECOG\`).
- Screen-failure data other than demographics and disposition are not mapped to SDTM (study convention).

## Known simplifications (educational)

1. **Laboratory panel**: 7 tests (ALT, AST, bilirubin, creatinine, hemoglobin, neutrophils, platelets) instead of the
   10 listed in the study specification (ALP, albumin and leukocytes are not generated), and the panel is collected on
   Day 1 of **every other cycle** (plus screening, Cycle 1 Day 1, Cycle 1 Day 8 hematology, end of treatment and
   safety follow-up) rather than every cycle. This keeps the package small enough to ship with the app.
2. **Tumor data**: only the collected sum of diameters (\`TR\`, \`SUMDIAM\`) is mapped; individual lesions and the
   \`TU\` domain are omitted, and only the overall response (\`OVRLRESP\`) is mapped to \`RS\` — non-target response and
   the new-lesion indicator stay in \`raw/tumor_assessment.csv\`.
3. **Coding**: adverse events and medical history use MedDRA-*like* preferred terms and system organ classes with
   **US spelling and no MedDRA codes** (real MedDRA uses UK spelling, e.g. "Diarrhoea", and numeric codes);
   medications use generic names with ATC-*like* class text and no WHO Drug codes.
4. **Laboratory toxicity grading** in ADLB follows CTCAE v5 thresholds but always compares with the normal range,
   not the CTCAE rules for subjects with abnormal baselines.
5. **Baseline disease characteristics** (histology, stage, PD-L1, prior lines, prior IO, brain metastases, smoking)
   are carried in \`SUPPDM\`; a production study would use MH, SU or a findings domain.
6. \`--BLFL\` is not populated (it is Permissible): the last pre-dose record is flagged with \`--LOBXFL\` in SDTM and
   baseline selection is made explicitly in ADaM (\`ABLFL\`).
7. Unscheduled visits are numbered "preceding scheduled VISITNUM + 0.01" and tumor-assessment visits are numbered
   1000 + nominal week. Both are **conventions**, not CDISC rules.
8. Sponsor conventions are labelled as such in \`manifest.json\`; anything that is a CDISC requirement cites the
   codelist (checked against the NCI EVS CDISC SDTM CT package dated 2026-03-27).

## Regenerating

\`\`\`bash
npx tsx scripts/data/oncology/generate.ts          # or: npm run data -- oncology
Rscript scripts/data/oncology/verify.R data/oncology   # recompute STUDY_FACTS.md and run checks
npm run validate                                   # manifest + content validation
\`\`\`

The generator is deterministic: seed \`${i.seed}\` always produces byte-identical files
(\`shasum\` the folder twice to confirm). Pass \`--seed N\` to explore a different realization —
the subject-flow counts stay fixed, the statistics move with sampling noise.
`;
}

export function answerKeyReadme(raw: RawResult): string {
  const byType = new Map<string, { n: number; rows: number }>();
  for (const x of raw.issues) {
    const e = byType.get(x.type) ?? { n: 0, rows: 0 };
    e.n++;
    e.rows += x.n ?? 1;
    byType.set(x.type, e);
  }
  const lines = [...byType.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([t, e]) => `| ${t} | ${e.n} | ${fmt(e.rows)} |`);
  return `# Answer key — stop and read this

\`data_issues.csv\` lists **every problem that was deliberately injected into \`raw/\`**, how a data manager
resolved it, and the value the SDTM layer uses. It is the answer sheet.

**Do not open it before you have tried to find the problems yourself.** Profiling the raw files —
duplicates, impossible dates, out-of-range values, inconsistent coding, orphan keys, partial dates,
unit mismatches — is the exercise. Reading the answers first removes it.

When you do check your work:

- \`RECORD_ID\` points at the row in the named raw file. \`MULTIPLE\` means the entry documents a pattern
  (with \`N_RECORDS\` telling you how many rows it covers) rather than one row; \`(missing)\` means the problem
  is that a row is *absent* from the export.
- \`PROBLEM_NO\` maps to the numbered list in \`docs/specs/oncology-study-spec.md\` §3.
- Entries whose \`ISSUE_TYPE\` starts with **TRUE FINDING** or **GENUINE EXTREME VALUE** are *not* errors:
  dispensing errors, stratification errors, source-verified extreme laboratory values and the four
  randomized-but-never-treated subjects are real events. Cleaning them away is a mistake.

| Issue type | Entries | Raw records covered |
|---|---|---|
${lines.join('\n')}

Total entries: ${raw.issues.length}.
`;
}
